import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { createInterface } from "node:readline";
import { BacklogClient, resolveApiKey, type WikiAttachment } from "../backlog-client.js";
import { loadConfig, saveConfig, type Mapping } from "../config.js";
import { convertLocalToBacklog } from "../content-converter.js";
import { pathToWikiName, attachmentDir } from "../path-converter.js";

interface PushOptions {
  apiKey?: string;
  force: boolean;
  yes: boolean;
}

function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function uploadNewAttachments(
  client: BacklogClient,
  wikiId: number,
  mdFilePath: string,
  remoteAttachments: WikiAttachment[],
): Promise<void> {
  const attDir = attachmentDir(mdFilePath);
  if (!existsSync(attDir)) return;

  const remoteNames = new Set(remoteAttachments.map((a) => a.name));
  const entries = await readdir(attDir);
  const newFiles = entries.filter((name) => !remoteNames.has(name));

  if (newFiles.length === 0) return;

  const uploadedIds: number[] = [];
  for (const filename of newFiles) {
    const filePath = join(attDir, filename);
    const data = await readFile(filePath);
    console.log(`    添付アップロード: ${filename}`);
    const uploaded = await client.uploadAttachment(filename, data);
    uploadedIds.push(uploaded.id);
  }

  await client.attachFilesToWiki(wikiId, uploadedIds);
}

async function findMdFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findMdFiles(fullPath)));
    } else if (extname(entry.name) === ".md") {
      results.push(fullPath);
    }
  }
  return results;
}

async function getChangedFiles(
  since: string,
  docsDir: string,
  mappings: Mapping[],
): Promise<string[]> {
  const sinceDate = new Date(since);
  const changed: string[] = [];
  const knownPaths = new Set(mappings.map((m) => m.path));

  // マッピング済みファイルのチェック
  for (const mapping of mappings) {
    try {
      const fileStat = await stat(mapping.path);
      if (fileStat.mtime > sinceDate) {
        changed.push(mapping.path);
      }
    } catch {
      // ファイルが存在しない場合はスキップ
    }
  }

  // docs/ 配下の未登録ファイル（新規追加）を検出
  try {
    const allMdFiles = await findMdFiles(docsDir);
    for (const filePath of allMdFiles) {
      if (!knownPaths.has(filePath)) {
        changed.push(filePath);
      }
    }
  } catch {
    // docs ディレクトリが存在しない場合はスキップ
  }

  return changed;
}

export async function pushCommand(options: PushOptions): Promise<void> {
  const config = await loadConfig();
  const apiKey = resolveApiKey(options.apiKey);
  const client = new BacklogClient(config.space, apiKey);

  if (!config.last_pushed_at && !config.last_pulled_at) {
    console.error(
      "last_pushed_at / last_pulled_at が未設定です。先に init または pull を実行してください。",
    );
    process.exit(1);
  }

  // 上の条件分岐で両方 null のケースは除外済み
  const since = (config.last_pushed_at ?? config.last_pulled_at) as string;
  const changedFiles = await getChangedFiles(since, config.docs_dir, config.mappings);

  if (changedFiles.length === 0) {
    console.log("push 対象の変更ファイルはありません。");
    return;
  }

  console.log(`${changedFiles.length} 件の変更ファイルを検出しました。`);
  for (const f of changedFiles) {
    console.log(`  - ${f}`);
  }

  if (!options.yes) {
    const ok = await confirm("\nBacklog に push しますか？ (y/N): ");
    if (!ok) {
      console.log("キャンセルしました。");
      return;
    }
  }

  // マッピングをパスで引けるように
  const mappingByPath = new Map<string, Mapping>();
  for (const m of config.mappings) {
    mappingByPath.set(m.path, m);
  }

  // Wiki 一覧を取得（projectId 取得用）
  const wikiList = await client.getWikiList(config.project_key);
  const projectId = wikiList.length > 0 ? wikiList[0].projectId : null;

  let pushed = 0;
  let skipped = 0;
  let conflicted = 0;
  const conflicts: string[] = [];

  for (const filePath of changedFiles) {
    const mapping = mappingByPath.get(filePath);

    // backlog-to-git のページはスキップ
    if (mapping?.sync === "backlog-to-git") {
      console.log(`  スキップ (backlog-to-git): ${filePath}`);
      skipped++;
      continue;
    }

    const rawContent = await readFile(filePath, "utf-8");
    const wikiName = pathToWikiName(filePath, config.docs_dir);

    if (mapping) {
      // 既存ページの更新
      const remote = await client.getWiki(mapping.wiki_id);

      // ローカルの相対パスを Backlog API URL に変換
      const localContent = convertLocalToBacklog(
        rawContent,
        filePath,
        mapping.wiki_id,
        remote.attachments,
        config.space,
      );

      // 競合チェック: Backlog 側の内容がローカルと異なるか確認
      if (!options.force && remote.content !== localContent) {
        // Backlog 側に変更があるかもしれない → 更新日時で判定
        const remoteUpdated = new Date(remote.updated);
        const lastPulled = config.last_pulled_at
          ? new Date(config.last_pulled_at)
          : null;

        if (lastPulled && remoteUpdated > lastPulled) {
          console.error(
            `  ⚠ 競合: ${wikiName} — Backlog 側で変更があります。スキップします。`,
          );
          console.error(
            `    (--force で強制上書きできます)`,
          );
          conflicts.push(wikiName);
          conflicted++;
          continue;
        }
      }

      // 差分がない場合はスキップ
      if (remote.content === localContent) {
        console.log(`  差分なし: ${wikiName}`);
        skipped++;
        continue;
      }

      console.log(`  更新中: ${wikiName}`);
      await client.updateWiki(mapping.wiki_id, localContent);
      await uploadNewAttachments(client, mapping.wiki_id, filePath, remote.attachments);
      pushed++;
    } else {
      // 新規ページの作成
      if (!projectId) {
        console.error(
          `  エラー: プロジェクト ID を取得できません。Wiki が1件もありません。`,
        );
        skipped++;
        continue;
      }

      console.log(`  新規作成: ${wikiName}`);
      const created = await client.createWiki(projectId, wikiName, rawContent);
      await uploadNewAttachments(client, created.id, filePath, []);

      // マッピングに追加
      config.mappings.push({
        wiki_id: created.id,
        path: filePath,
        sync: "bidirectional",
      });
      pushed++;
    }
  }

  config.last_pushed_at = new Date().toISOString();
  await saveConfig(config);

  console.log(`\n完了: ${pushed} 件 push, ${skipped} 件スキップ, ${conflicted} 件競合`);

  if (conflicts.length > 0) {
    console.log("\n競合があったページ:");
    for (const name of conflicts) {
      console.log(`  - ${name}`);
    }
  }
}

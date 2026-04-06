import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { BacklogClient, resolveApiKey } from "../backlog-client.js";
import { loadConfig, saveConfig, type Mapping } from "../config.js";
import { pathToWikiName } from "../path-converter.js";

interface PushOptions {
  apiKey?: string;
  force: boolean;
}

function getChangedFiles(since: string, docsDir: string): string[] {
  try {
    const output = execSync(
      `git log --since="${since}" --diff-filter=ACMR --name-only --pretty=format: -- "${docsDir}"`,
      { encoding: "utf-8" },
    );
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.endsWith(".md"));
  } catch {
    return [];
  }
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
  const changedFiles = getChangedFiles(since, config.docs_dir);

  if (changedFiles.length === 0) {
    console.log("push 対象の変更ファイルはありません。");
    return;
  }

  console.log(`${changedFiles.length} 件の変更ファイルを検出しました。`);

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

    const localContent = await readFile(filePath, "utf-8");
    const wikiName = pathToWikiName(filePath, config.docs_dir);

    if (mapping) {
      // 既存ページの更新
      const remote = await client.getWiki(mapping.wiki_id);

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
      const created = await client.createWiki(projectId, wikiName, localContent);

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

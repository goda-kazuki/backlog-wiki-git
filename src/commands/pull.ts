import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { BacklogClient, resolveApiKey } from "../backlog-client.js";
import { loadConfig, saveConfig, type Mapping } from "../config.js";
import { convertBacklogToLocal } from "../content-converter.js";
import { wikiNameToPath, attachmentDir } from "../path-converter.js";

interface PullOptions {
  apiKey?: string;
}

async function syncAttachments(
  client: BacklogClient,
  wikiId: number,
  mdPath: string,
  docsDir: string,
  remoteAttachments: { id: number; name: string }[],
): Promise<void> {
  const attDir = attachmentDir(mdPath, docsDir);

  // リモートに添付ファイルがある場合: ダウンロード
  if (remoteAttachments.length > 0) {
    await mkdir(attDir, { recursive: true });

    const localFiles = await safeReaddir(attDir);
    const localNames = new Set(localFiles);

    for (const att of remoteAttachments) {
      if (!localNames.has(att.name)) {
        console.log(`    添付ダウンロード: ${att.name}`);
        const { data } = await client.getAttachment(wikiId, att.id);
        await writeFile(`${attDir}/${att.name}`, Buffer.from(data));
      }
    }
  }

  // ローカルにあってリモートにないファイルを削除
  if (existsSync(attDir)) {
    const remoteNames = new Set(remoteAttachments.map((a) => a.name));
    const localEntries = await readdir(attDir, { withFileTypes: true });
    for (const entry of localEntries) {
      if (entry.isFile() && !remoteNames.has(entry.name)) {
        console.log(`    添付削除: ${entry.name}`);
        await rm(join(attDir, entry.name));
      }
    }
    // ディレクトリが空になったら削除
    const remaining = await readdir(attDir);
    if (remaining.length === 0) {
      await rm(attDir, { recursive: true });
    }
  }
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

export async function pullCommand(options: PullOptions): Promise<void> {
  const config = await loadConfig();
  const apiKey = resolveApiKey(options.apiKey);
  const client = new BacklogClient(config.space, apiKey);

  const lastPulledAt = config.last_pulled_at
    ? new Date(config.last_pulled_at)
    : null;

  console.log("Backlog Wiki 一覧を取得中...");
  const wikiList = await client.getWikiList(config.project_key);

  // last_pulled_at 以降に更新されたページをフィルタ
  const updatedPages = lastPulledAt
    ? wikiList.filter((w) => new Date(w.updated) > lastPulledAt)
    : wikiList;

  // マッピングの wiki_id セットを作成
  const mappingByWikiId = new Map<number, Mapping>();
  for (const m of config.mappings) {
    mappingByWikiId.set(m.wiki_id, m);
  }

  let pulled = 0;
  let skipped = 0;
  const newMappings: Mapping[] = [];
  const processedWikiIds = new Set<number>();

  // 1. 更新されたページのコンテンツ + 添付ファイルを同期
  if (updatedPages.length > 0) {
    console.log(`${updatedPages.length} 件の更新があります。`);
  }

  for (const summary of updatedPages) {
    const mapping = mappingByWikiId.get(summary.id);

    if (mapping?.sync === "git-to-backlog") {
      console.log(`  スキップ (git-to-backlog): ${summary.name}`);
      skipped++;
      processedWikiIds.add(summary.id);
      continue;
    }

    console.log(`  取得中: ${summary.name}`);
    const wiki = await client.getWiki(summary.id);

    const expectedPath = wikiNameToPath(wiki.name, config.docs_dir);
    let mdPath = mapping?.path ?? expectedPath;

    // リネーム検知
    if (mapping && mapping.path !== expectedPath) {
      console.log(`  リネーム検知: ${mapping.path} → ${expectedPath}`);
      if (existsSync(mapping.path)) {
        await rm(mapping.path);
      }
      const oldAttDir = attachmentDir(mapping.path, config.docs_dir);
      if (existsSync(oldAttDir)) {
        await rm(oldAttDir, { recursive: true });
      }
      mapping.path = expectedPath;
      mdPath = expectedPath;
    }

    // コンテンツ内の添付ファイル参照パスを変換
    const convertedContent = convertBacklogToLocal(
      wiki.content ?? "",
      mdPath,
      config.docs_dir,
      wiki.attachments,
      config.space,
    );

    // Markdown ファイルを保存
    await mkdir(dirname(mdPath), { recursive: true });
    await writeFile(mdPath, convertedContent, "utf-8");

    // 添付ファイルを同期
    await syncAttachments(client, wiki.id, mdPath, config.docs_dir, wiki.attachments);

    if (!mapping) {
      newMappings.push({
        wiki_id: wiki.id,
        path: mdPath,
        sync: "bidirectional",
      });
    }

    processedWikiIds.add(summary.id);
    pulled++;
  }

  // 2. 更新対象外のページでも、ローカルに添付ディレクトリがあれば添付ファイルを同期
  const attachmentSyncTargets = config.mappings.filter(
    (m) =>
      !processedWikiIds.has(m.wiki_id) &&
      m.sync !== "git-to-backlog" &&
      existsSync(attachmentDir(m.path, config.docs_dir)),
  );

  if (attachmentSyncTargets.length > 0) {
    console.log(`\n添付ファイルの同期チェック: ${attachmentSyncTargets.length} 件`);

    for (const mapping of attachmentSyncTargets) {
      const wiki = await client.getWiki(mapping.wiki_id);
      await syncAttachments(client, wiki.id, mapping.path, config.docs_dir, wiki.attachments);
    }
  }

  // 新規マッピングを追加
  if (newMappings.length > 0) {
    config.mappings.push(...newMappings);
    console.log(`\n${newMappings.length} 件の新規ページをマッピングに追加しました。`);
  }

  const now = new Date().toISOString();
  config.last_pulled_at = now;
  config.last_pushed_at = now;
  await saveConfig(config);

  console.log(`\n完了: ${pulled} 件取得, ${skipped} 件スキップ`);
}

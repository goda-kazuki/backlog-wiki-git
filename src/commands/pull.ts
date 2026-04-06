import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { BacklogClient, resolveApiKey } from "../backlog-client.js";
import { loadConfig, saveConfig, type Mapping } from "../config.js";
import { wikiNameToPath, attachmentDir } from "../path-converter.js";

interface PullOptions {
  apiKey?: string;
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

  if (updatedPages.length === 0) {
    console.log("更新されたページはありません。");
    return;
  }

  console.log(`${updatedPages.length} 件の更新があります。`);

  // マッピングの wiki_id セットを作成
  const mappingByWikiId = new Map<number, Mapping>();
  for (const m of config.mappings) {
    mappingByWikiId.set(m.wiki_id, m);
  }

  let pulled = 0;
  let skipped = 0;
  const newMappings: Mapping[] = [];

  for (const summary of updatedPages) {
    const mapping = mappingByWikiId.get(summary.id);

    // git-to-backlog のページはスキップ
    if (mapping?.sync === "git-to-backlog") {
      console.log(`  スキップ (git-to-backlog): ${summary.name}`);
      skipped++;
      continue;
    }

    console.log(`  取得中: ${summary.name}`);
    const wiki = await client.getWiki(summary.id);

    const mdPath = mapping?.path ?? wikiNameToPath(wiki.name, config.docs_dir);

    // Markdown ファイルを保存
    await mkdir(dirname(mdPath), { recursive: true });
    await writeFile(mdPath, wiki.content, "utf-8");

    // 添付ファイルを保存
    if (wiki.attachments.length > 0) {
      const attDir = attachmentDir(mdPath);
      await mkdir(attDir, { recursive: true });

      for (const att of wiki.attachments) {
        console.log(`    添付: ${att.name}`);
        const { data } = await client.getAttachment(wiki.id, att.id);
        await writeFile(`${attDir}/${att.name}`, Buffer.from(data));
      }
    }

    // 新規ページの場合はマッピングに追加
    if (!mapping) {
      newMappings.push({
        wiki_id: wiki.id,
        path: mdPath,
        sync: "bidirectional",
      });
    }

    pulled++;
  }

  // 新規マッピングを追加
  if (newMappings.length > 0) {
    config.mappings.push(...newMappings);
    console.log(`\n${newMappings.length} 件の新規ページをマッピングに追加しました。`);
  }

  config.last_pulled_at = new Date().toISOString();
  await saveConfig(config);

  console.log(`\n完了: ${pulled} 件取得, ${skipped} 件スキップ`);
}

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import { BacklogClient, resolveApiKey } from "../backlog-client.js";
import { saveConfig, type Config, type Mapping } from "../config.js";
import { wikiNameToPath, attachmentDir } from "../path-converter.js";

interface InitOptions {
  project: string;
  output: string;
  space?: string;
  apiKey?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const space = options.space || process.env.BACKLOG_SPACE;
  if (!space) {
    console.error(
      "スペースが指定されていません。--space オプションまたは環境変数 BACKLOG_SPACE を設定してください。",
    );
    process.exit(1);
  }

  const apiKey = resolveApiKey(options.apiKey);
  const client = new BacklogClient(space, apiKey);
  const docsDir = options.output.replace(/\/$/, "");

  if (existsSync("backlog-sync.json")) {
    console.warn(
      "⚠ backlog-sync.json が既に存在します。上書きします。",
    );
  }

  console.log(`Backlog Wiki 一覧を取得中... (project: ${options.project})`);
  const wikiList = await client.getWikiList(options.project);
  console.log(`${wikiList.length} 件の Wiki ページが見つかりました。`);

  const mappings: Mapping[] = [];

  for (let i = 0; i < wikiList.length; i++) {
    const summary = wikiList[i];
    const progress = `[${i + 1}/${wikiList.length}]`;
    console.log(`${progress} ${summary.name} を取得中...`);

    const wiki = await client.getWiki(summary.id);
    const mdPath = wikiNameToPath(wiki.name, docsDir);

    // Markdown ファイルを保存
    await mkdir(dirname(mdPath), { recursive: true });
    await writeFile(mdPath, wiki.content ?? "", "utf-8");

    // 添付ファイルを保存
    if (wiki.attachments.length > 0) {
      const attDir = attachmentDir(mdPath);
      await mkdir(attDir, { recursive: true });

      for (const att of wiki.attachments) {
        console.log(`  添付ファイル: ${att.name}`);
        const { data } = await client.getAttachment(wiki.id, att.id);
        const attPath = `${attDir}/${att.name}`;
        await writeFile(attPath, Buffer.from(data));
      }
    }

    mappings.push({
      wiki_id: wiki.id,
      path: mdPath,
      sync: "bidirectional",
    });
  }

  const now = new Date().toISOString();
  const config: Config = {
    space,
    project_key: options.project,
    docs_dir: docsDir,
    last_pulled_at: now,
    last_pushed_at: now,
    mappings,
  };

  await saveConfig(config);

  console.log(`\n完了: ${mappings.length} 件の Wiki ページを ${docsDir}/ に保存しました。`);
  console.log("backlog-sync.json を生成しました。");
}

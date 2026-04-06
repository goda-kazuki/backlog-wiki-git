import { join, relative, dirname, basename, extname } from "node:path";

/**
 * Wiki 名をローカルファイルパスに変換する
 * 例: "設計/パラメータシート/Amazon SQS" → "docs/設計/パラメータシート/Amazon SQS.md"
 */
export function wikiNameToPath(wikiName: string, docsDir: string): string {
  return join(docsDir, `${wikiName}.md`);
}

/**
 * ローカルファイルパスを Wiki 名に変換する
 * 例: "docs/設計/パラメータシート/Amazon SQS.md" → "設計/パラメータシート/Amazon SQS"
 */
export function pathToWikiName(filePath: string, docsDir: string): string {
  const rel = relative(docsDir, filePath);
  const ext = extname(rel);
  if (ext === ".md") {
    return rel.slice(0, -ext.length);
  }
  return rel;
}

/**
 * 添付ファイルの保存先ディレクトリを取得する
 * 例: "docs/設計/パラメータシート/Amazon SQS.md"
 *   → "docs/設計/パラメータシート/Amazon SQS/"
 */
export function attachmentDir(mdFilePath: string): string {
  const dir = dirname(mdFilePath);
  const base = basename(mdFilePath, ".md");
  return join(dir, base);
}

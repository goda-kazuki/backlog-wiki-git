import { join, relative, extname } from "node:path";

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
 * 例: "docs/設計/パラメータシート/Amazon SQS.md", docsDir="docs"
 *   → "docs/.attachments/設計/パラメータシート/Amazon SQS/"
 */
export function attachmentDir(mdFilePath: string, docsDir: string): string {
  const rel = relative(docsDir, mdFilePath);
  const ext = extname(rel);
  const withoutExt = ext === ".md" ? rel.slice(0, -ext.length) : rel;
  return join(docsDir, ".attachments", withoutExt);
}

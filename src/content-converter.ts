import { dirname, relative } from "node:path";
import { attachmentDir } from "./path-converter.js";

/**
 * Backlog Wiki のコンテンツ内の添付ファイル参照をローカルの相対パスに変換する (pull 時)
 *
 * Backlog Wiki の添付ファイル参照形式:
 *   ![image](https://{space}/api/v2/wikis/{wikiId}/attachments/{attachmentId})
 *
 * ローカルの参照形式:
 *   ![image](.attachments/Home/filename.png)
 */

interface AttachmentInfo {
  id: number;
  name: string;
}

/**
 * Backlog API の添付ファイル URL をローカル相対パスに変換する
 */
export function convertBacklogToLocal(
  content: string,
  mdFilePath: string,
  docsDir: string,
  attachments: AttachmentInfo[],
  space: string,
): string {
  const attachmentMap = new Map<number, string>();
  for (const att of attachments) {
    attachmentMap.set(att.id, att.name);
  }

  const attDir = attachmentDir(mdFilePath, docsDir);
  const mdDir = dirname(mdFilePath);
  const relAttDir = relative(mdDir, attDir);

  const urlPattern = new RegExp(
    `(!?\\[[^\\]]*\\])\\(https?://${escapeRegex(space)}/api/v2/wikis/\\d+/attachments/(\\d+)\\)`,
    "g",
  );

  return content.replace(urlPattern, (_match, prefix: string, attIdStr: string) => {
    const attId = parseInt(attIdStr, 10);
    const filename = attachmentMap.get(attId);
    if (filename) {
      return `${prefix}(${relAttDir}/${filename})`;
    }
    return _match;
  });
}

/**
 * ローカルの相対パスを Backlog API の添付ファイル URL に変換する (push 時)
 */
export function convertLocalToBacklog(
  content: string,
  mdFilePath: string,
  docsDir: string,
  wikiId: number,
  attachments: AttachmentInfo[],
  space: string,
): string {
  const nameToId = new Map<string, number>();
  for (const att of attachments) {
    nameToId.set(att.name, att.id);
  }

  const attDir = attachmentDir(mdFilePath, docsDir);
  const mdDir = dirname(mdFilePath);
  const relAttDir = relative(mdDir, attDir);

  const localPattern = new RegExp(
    `(!?\\[[^\\]]*\\])\\(${escapeRegex(relAttDir)}/([^)]+)\\)`,
    "g",
  );

  return content.replace(localPattern, (_match, prefix: string, filename: string) => {
    const attId = nameToId.get(filename);
    if (attId) {
      return `${prefix}(https://${space}/api/v2/wikis/${wikiId}/attachments/${attId})`;
    }
    return _match;
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

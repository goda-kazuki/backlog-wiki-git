import { basename, dirname, relative } from "node:path";

/**
 * Backlog Wiki のコンテンツ内の添付ファイル参照をローカルの相対パスに変換する (pull 時)
 *
 * Backlog Wiki の添付ファイル参照形式:
 *   ![image](https://{space}/api/v2/wikis/{wikiId}/attachments/{attachmentId})
 *   [file](https://{space}/api/v2/wikis/{wikiId}/attachments/{attachmentId})
 *
 * ローカルの参照形式:
 *   ![image](WikiName/filename.png)
 *   [file](WikiName/filename.txt)
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
  wikiName: string,
  attachments: AttachmentInfo[],
  space: string,
): string {
  // 添付ファイル ID → ファイル名のマップを作成
  const attachmentMap = new Map<number, string>();
  for (const att of attachments) {
    attachmentMap.set(att.id, att.name);
  }

  // Wiki 名の最後のセグメントがディレクトリ名になる
  const localDir = basename(wikiName);

  // Markdown リンク/画像の URL を変換
  // ![alt](https://space/api/v2/wikis/123/attachments/456)
  // [text](https://space/api/v2/wikis/123/attachments/456)
  const urlPattern = new RegExp(
    `(!?\\[[^\\]]*\\])\\(https?://${escapeRegex(space)}/api/v2/wikis/\\d+/attachments/(\\d+)\\)`,
    "g",
  );

  return content.replace(urlPattern, (_match, prefix: string, attIdStr: string) => {
    const attId = parseInt(attIdStr, 10);
    const filename = attachmentMap.get(attId);
    if (filename) {
      return `${prefix}(${localDir}/${filename})`;
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
  wikiId: number,
  attachments: AttachmentInfo[],
  space: string,
): string {
  // ファイル名 → 添付ファイル ID のマップ
  const nameToId = new Map<string, number>();
  for (const att of attachments) {
    nameToId.set(att.name, att.id);
  }

  // Wiki名の最後のセグメント（ディレクトリ名）
  const mdBase = basename(mdFilePath, ".md");

  // ローカル相対パスのパターン: ![alt](DirName/filename.png) or [text](DirName/filename.txt)
  const localPattern = new RegExp(
    `(!?\\[[^\\]]*\\])\\(${escapeRegex(mdBase)}/([^)]+)\\)`,
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

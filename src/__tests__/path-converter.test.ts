import { describe, it, expect } from "vitest";
import { wikiNameToPath, pathToWikiName, attachmentDir } from "../path-converter.js";

describe("wikiNameToPath", () => {
  it("シンプルな Wiki 名を変換する", () => {
    expect(wikiNameToPath("Home", "docs")).toBe("docs/Home.md");
  });

  it("/ を含む Wiki 名をディレクトリ構造に変換する", () => {
    expect(wikiNameToPath("設計/パラメータシート/Amazon SQS", "docs")).toBe(
      "docs/設計/パラメータシート/Amazon SQS.md",
    );
  });

  it("末尾にスラッシュのない docsDir を処理する", () => {
    expect(wikiNameToPath("要件", "docs")).toBe("docs/要件.md");
  });
});

describe("pathToWikiName", () => {
  it(".md ファイルパスを Wiki 名に変換する", () => {
    expect(pathToWikiName("docs/Home.md", "docs")).toBe("Home");
  });

  it("ネストされたパスを Wiki 名に変換する", () => {
    expect(
      pathToWikiName("docs/設計/パラメータシート/Amazon SQS.md", "docs"),
    ).toBe("設計/パラメータシート/Amazon SQS");
  });

  it(".md 以外の拡張子はそのまま返す", () => {
    expect(pathToWikiName("docs/image.png", "docs")).toBe("image.png");
  });
});

describe("attachmentDir", () => {
  it("Markdown ファイルに対応する .attachments ディレクトリパスを返す", () => {
    expect(attachmentDir("docs/Home.md", "docs")).toBe("docs/.attachments/Home");
  });

  it("ネストされたパスでも正しく動作する", () => {
    expect(
      attachmentDir("docs/設計/パラメータシート/Amazon SQS.md", "docs"),
    ).toBe("docs/.attachments/設計/パラメータシート/Amazon SQS");
  });
});

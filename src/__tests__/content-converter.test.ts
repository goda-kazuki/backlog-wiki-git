import { describe, it, expect } from "vitest";
import {
  convertBacklogToLocal,
  convertLocalToBacklog,
} from "../content-converter.js";

const SPACE = "example.backlog.jp";

describe("convertBacklogToLocal", () => {
  it("Backlog API URL をローカル相対パスに変換する", () => {
    const content =
      "![diagram](https://example.backlog.jp/api/v2/wikis/100/attachments/200)";
    const result = convertBacklogToLocal(
      content,
      "docs/設計/Amazon SQS.md",
      "docs",
      [{ id: 200, name: "diagram.png" }],
      SPACE,
    );
    expect(result).toBe("![diagram](../.attachments/設計/Amazon SQS/diagram.png)");
  });

  it("トップレベルの .md ファイルでは .attachments/ への相対パスになる", () => {
    const content =
      "![img](https://example.backlog.jp/api/v2/wikis/100/attachments/201)";
    const result = convertBacklogToLocal(
      content,
      "docs/Home.md",
      "docs",
      [{ id: 201, name: "a.png" }],
      SPACE,
    );
    expect(result).toBe("![img](.attachments/Home/a.png)");
  });

  it("複数の添付ファイル参照を変換する", () => {
    const content = [
      "![img1](https://example.backlog.jp/api/v2/wikis/100/attachments/201)",
      "![img2](https://example.backlog.jp/api/v2/wikis/100/attachments/202)",
    ].join("\n");
    const result = convertBacklogToLocal(
      content,
      "docs/Home.md",
      "docs",
      [
        { id: 201, name: "a.png" },
        { id: 202, name: "b.png" },
      ],
      SPACE,
    );
    expect(result).toBe("![img1](.attachments/Home/a.png)\n![img2](.attachments/Home/b.png)");
  });

  it("マッチしない添付ファイル ID はそのまま残す", () => {
    const content =
      "![x](https://example.backlog.jp/api/v2/wikis/100/attachments/999)";
    const result = convertBacklogToLocal(content, "docs/Home.md", "docs", [], SPACE);
    expect(result).toBe(content);
  });

  it("通常のリンクも変換する", () => {
    const content =
      "[資料](https://example.backlog.jp/api/v2/wikis/100/attachments/300)";
    const result = convertBacklogToLocal(
      content,
      "docs/Home.md",
      "docs",
      [{ id: 300, name: "doc.pdf" }],
      SPACE,
    );
    expect(result).toBe("[資料](.attachments/Home/doc.pdf)");
  });
});

describe("convertLocalToBacklog", () => {
  it("ローカル相対パスを Backlog API URL に変換する", () => {
    const content = "![diagram](../.attachments/設計/Amazon SQS/diagram.png)";
    const result = convertLocalToBacklog(
      content,
      "docs/設計/Amazon SQS.md",
      "docs",
      100,
      [{ id: 200, name: "diagram.png" }],
      SPACE,
    );
    expect(result).toBe(
      "![diagram](https://example.backlog.jp/api/v2/wikis/100/attachments/200)",
    );
  });

  it("トップレベルの .md ファイルの相対パスを変換する", () => {
    const content = "![img](.attachments/Home/image.png)";
    const result = convertLocalToBacklog(
      content,
      "docs/Home.md",
      "docs",
      100,
      [{ id: 201, name: "image.png" }],
      SPACE,
    );
    expect(result).toBe(
      "![img](https://example.backlog.jp/api/v2/wikis/100/attachments/201)",
    );
  });

  it("マッチしないファイル名はそのまま残す", () => {
    const content = "![x](.attachments/Home/unknown.png)";
    const result = convertLocalToBacklog(
      content,
      "docs/Home.md",
      "docs",
      100,
      [],
      SPACE,
    );
    expect(result).toBe(content);
  });
});

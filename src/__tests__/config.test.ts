import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, unlink } from "node:fs/promises";
import { loadConfig, saveConfig, type Config } from "../config.js";

const TEST_CONFIG: Config = {
  space: "example.backlog.jp",
  project_key: "TEST_PROJECT",
  docs_dir: "docs",
  last_pulled_at: "2026-04-06T10:00:00Z",
  last_pushed_at: null,
  mappings: [
    {
      wiki_id: 123,
      path: "docs/Home.md",
      sync: "bidirectional",
    },
    {
      wiki_id: 456,
      path: "docs/要件.md",
      sync: "backlog-to-git",
    },
  ],
};

describe("config", () => {
  beforeEach(async () => {
    await writeFile(
      "backlog-sync.json",
      JSON.stringify(TEST_CONFIG, null, 2),
      "utf-8",
    );
  });

  afterEach(async () => {
    try {
      await unlink("backlog-sync.json");
    } catch {
      // ignore
    }
  });

  it("設定ファイルを正しく読み込む", async () => {
    const config = await loadConfig();
    expect(config.space).toBe("example.backlog.jp");
    expect(config.project_key).toBe("TEST_PROJECT");
    expect(config.mappings).toHaveLength(2);
    expect(config.mappings[0].sync).toBe("bidirectional");
  });

  it("設定ファイルを正しく書き込む", async () => {
    const modified = { ...TEST_CONFIG, last_pushed_at: "2026-04-06T12:00:00Z" };
    await saveConfig(modified);
    const reloaded = await loadConfig();
    expect(reloaded.last_pushed_at).toBe("2026-04-06T12:00:00Z");
  });

  it("不正な sync 値でバリデーションエラーになる", async () => {
    const invalid = {
      ...TEST_CONFIG,
      mappings: [{ wiki_id: 1, path: "docs/x.md", sync: "invalid" }],
    };
    await writeFile("backlog-sync.json", JSON.stringify(invalid), "utf-8");
    await expect(loadConfig()).rejects.toThrow("sync の値が不正です");
  });

  it("space が空の場合バリデーションエラーになる", async () => {
    const invalid = { ...TEST_CONFIG, space: "" };
    await writeFile("backlog-sync.json", JSON.stringify(invalid), "utf-8");
    await expect(loadConfig()).rejects.toThrow("space が必要です");
  });
});

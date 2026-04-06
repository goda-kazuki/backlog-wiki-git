import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export type SyncDirection = "git-to-backlog" | "backlog-to-git" | "bidirectional";

export interface Mapping {
  wiki_id: number;
  path: string;
  sync: SyncDirection;
}

export interface Config {
  space: string;
  project_key: string;
  docs_dir: string;
  last_pulled_at: string | null;
  last_pushed_at: string | null;
  mappings: Mapping[];
}

const CONFIG_FILE = "backlog-sync.json";

const VALID_SYNC_VALUES: SyncDirection[] = [
  "git-to-backlog",
  "backlog-to-git",
  "bidirectional",
];

function validate(config: unknown): Config {
  if (typeof config !== "object" || config === null) {
    throw new Error("設定ファイルが不正です: オブジェクトではありません");
  }

  const c = config as Record<string, unknown>;

  if (typeof c.space !== "string" || !c.space) {
    throw new Error("設定ファイルが不正です: space が必要です");
  }
  if (typeof c.project_key !== "string" || !c.project_key) {
    throw new Error("設定ファイルが不正です: project_key が必要です");
  }
  if (typeof c.docs_dir !== "string" || !c.docs_dir) {
    throw new Error("設定ファイルが不正です: docs_dir が必要です");
  }

  if (!Array.isArray(c.mappings)) {
    throw new Error("設定ファイルが不正です: mappings が配列ではありません");
  }

  for (const m of c.mappings) {
    if (typeof m !== "object" || m === null) {
      throw new Error("設定ファイルが不正です: mapping エントリが不正です");
    }
    const mapping = m as Record<string, unknown>;
    if (typeof mapping.wiki_id !== "number") {
      throw new Error("設定ファイルが不正です: wiki_id が数値ではありません");
    }
    if (typeof mapping.path !== "string") {
      throw new Error("設定ファイルが不正です: path が文字列ではありません");
    }
    if (!VALID_SYNC_VALUES.includes(mapping.sync as SyncDirection)) {
      throw new Error(
        `設定ファイルが不正です: sync の値が不正です (${mapping.sync})。有効な値: ${VALID_SYNC_VALUES.join(", ")}`,
      );
    }
  }

  return {
    space: c.space,
    project_key: c.project_key,
    docs_dir: c.docs_dir,
    last_pulled_at: (c.last_pulled_at as string) || null,
    last_pushed_at: (c.last_pushed_at as string) || null,
    mappings: c.mappings as Mapping[],
  };
}

export async function loadConfig(): Promise<Config> {
  if (!existsSync(CONFIG_FILE)) {
    console.error(
      `${CONFIG_FILE} が見つかりません。先に backlog-wiki-sync init を実行してください。`,
    );
    process.exit(1);
  }

  const raw = await readFile(CONFIG_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  return validate(parsed);
}

export async function saveConfig(config: Config): Promise<void> {
  const json = JSON.stringify(config, null, 2) + "\n";
  await writeFile(CONFIG_FILE, json, "utf-8");
}

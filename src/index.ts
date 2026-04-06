import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { pullCommand } from "./commands/pull.js";
import { pushCommand } from "./commands/push.js";

const program = new Command();

program
  .name("backlog-wiki-sync")
  .description(
    "Backlog Wiki と Git リポジトリ間で Markdown ファイルを双方向同期する CLI ツール",
  )
  .version("0.1.0");

program
  .command("init")
  .description("Backlog から Wiki を全件取得し、マッピングファイルを自動生成")
  .requiredOption("--project <key>", "Backlog プロジェクトキー")
  .option("--output <dir>", "出力先ディレクトリ", "docs/")
  .option("--space <space>", "Backlog スペース (例: example.backlog.jp)")
  .option("--api-key <key>", "Backlog API キー (環境変数 BACKLOG_API_KEY でも可)")
  .action(initCommand);

program
  .command("pull")
  .description("Backlog → Git（差分のみ取得）")
  .option("--api-key <key>", "Backlog API キー")
  .action(pullCommand);

program
  .command("push")
  .description("Git → Backlog（差分のみ反映）")
  .option("--api-key <key>", "Backlog API キー")
  .option("--force", "Backlog 側の変更を無視して強制上書き", false)
  .action(pushCommand);

program.parse();

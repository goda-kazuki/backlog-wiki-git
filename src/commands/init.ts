interface InitOptions {
  project: string;
  output: string;
  space?: string;
  apiKey?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
  console.log("init コマンドは未実装です。", options);
  process.exit(1);
}

interface PushOptions {
  apiKey?: string;
  force: boolean;
}

export async function pushCommand(options: PushOptions): Promise<void> {
  console.log("push コマンドは未実装です。", options);
  process.exit(1);
}

interface PullOptions {
  apiKey?: string;
}

export async function pullCommand(options: PullOptions): Promise<void> {
  console.log("pull コマンドは未実装です。", options);
  process.exit(1);
}

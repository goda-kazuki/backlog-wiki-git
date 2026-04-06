# backlog-wiki-sync

Backlog Wiki と Git リポジトリ間で Markdown ファイルを双方向同期する CLI ツール。

## 特徴

- **init**: Backlog Wiki を全件取得し、ローカルに Markdown として保存
- **pull**: Backlog 側の更新ページのみを差分取得
- **push**: Git 側の変更ファイルのみを Backlog に反映
- **競合検知**: push 時に Backlog 側の変更を検知し、上書きを防止
- **添付ファイル対応**: 画像等の添付ファイルも同期、コンテンツ内の参照パスを自動変換
- **sync 方向制御**: ページごとに `git-to-backlog` / `backlog-to-git` / `bidirectional` を設定可能

## セットアップ

```bash
npm install
npm run build
```

## 使い方

### API キーの設定

環境変数またはコマンドオプションで指定します。

```bash
export BACKLOG_API_KEY=your-api-key
export BACKLOG_SPACE=example.backlog.jp  # init 時のみ
```

### 初期化 (init)

Backlog から Wiki を全件取得し、マッピングファイルを生成します。

```bash
npx backlog-wiki-sync init --project PROJECT_KEY --space example.backlog.jp --output docs/
```

実行後、以下が生成されます:

- `docs/` 配下に Markdown ファイル群
- `backlog-sync.json` (マッピング・設定ファイル)

### Backlog → Git (pull)

Backlog 側で更新されたページのみを取得します。

```bash
npx backlog-wiki-sync pull
```

### Git → Backlog (push)

`last_pushed_at` 以降にファイル更新日時 (mtime) が変わったファイルのみを Backlog に反映します。push 前に対象ファイル一覧を表示し、確認プロンプトで `y` を入力すると実行されます。Backlog 側の内容と比較し、差分がない場合はスキップします。

```bash
npx backlog-wiki-sync push
```

確認プロンプトをスキップするには `-y` を付けます。

```bash
npx backlog-wiki-sync push -y
```

Backlog 側に Git にない変更がある場合は警告してスキップします。強制上書きするには `--force` を付けます。

```bash
npx backlog-wiki-sync push --force
```

## 設定ファイル (backlog-sync.json)

`init` で自動生成されます。手動で `sync` 方向を変更できます。

```json
{
  "space": "example.backlog.jp",
  "project_key": "PROJECT_KEY",
  "docs_dir": "docs",
  "last_pulled_at": "2026-04-06T10:00:00Z",
  "last_pushed_at": "2026-04-06T12:00:00Z",
  "mappings": [
    {
      "wiki_id": 1076003530,
      "path": "docs/Home.md",
      "sync": "bidirectional"
    },
    {
      "wiki_id": 1076012773,
      "path": "docs/要件.md",
      "sync": "backlog-to-git"
    }
  ]
}
```

### sync 方向

| 値 | 意味 |
|----|------|
| `bidirectional` | 双方向同期 (デフォルト) |
| `git-to-backlog` | Git → Backlog のみ。push 対象、pull スキップ |
| `backlog-to-git` | Backlog → Git のみ。pull 対象、push スキップ |

## ディレクトリ構造

Wiki 名の `/` がディレクトリ区切りに変換されます。

```
設計/パラメータシート/Amazon SQS
  → docs/設計/パラメータシート/Amazon SQS.md

添付ファイル:
  → docs/設計/パラメータシート/Amazon SQS/diagram.png
```

## 開発

```bash
npm run build       # ビルド
npm run dev         # ウォッチモード
npm run typecheck   # 型チェック
npm test            # テスト実行
npm run lint        # lint
npm run format      # フォーマット
```

## 技術スタック

- TypeScript
- commander (CLI)
- tsup (ビルド)
- Vitest (テスト)

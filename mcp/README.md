# mr-quiz-mcp

MR Quiz Bot用のFirestore MCPサーバー。ClaudeがGoogle Cloud上のFirestoreに保存されたクイズデータに読み取り専用でアクセスし、学習分析を行えるようにします。

## 前提条件

- Google Cloud上にデプロイ済みのFirestoreデータベース
- [Application Default Credentials (ADC)](https://cloud.google.com/docs/authentication/application-default-credentials) の設定

```bash
gcloud auth application-default login
```

## セットアップ

### 1. 依存関係のインストールとビルド

mr-quiz リポジトリのルートで実行:

```bash
npm install
npm run build:mcp
```

### 2. MCPサーバーの登録（Claude Code の場合）

プロジェクトルート（mr-quiz の親ディレクトリ）の `.mcp.json` に以下を追加:

```json
{
  "mcpServers": {
    "mr-quiz": {
      "type": "stdio",
      "command": "node",
      "args": [
        "mr-quiz/mcp/dist/mcp/src/index.js"
      ],
      "env": {
        "GOOGLE_CLOUD_PROJECT": "your-gcp-project-id"
      }
    }
  }
}
```

### 3. 動作確認

Claudeに以下のように依頼:

```
get_user_stats で <ユーザーID> の統計を取得して
```

## 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `GOOGLE_CLOUD_PROJECT` | Yes | GCPプロジェクトID |
| `FIRESTORE_EMULATOR_HOST` | No | Emulatorホスト（ローカル開発時のみ） |

**`GOOGLE_CLOUD_PROJECT` は mr-quiz 本体の `.env` と同じ値を設定してください。**

## 利用可能なツール

| ツール | 説明 | 必須パラメータ |
|--------|------|----------------|
| `query_quizzes` | クイズ検索 | なし（全てオプション） |
| `get_user_stats` | ユーザー統計取得 | `accountId` |
| `analyze_weak_categories` | 苦手分野分析 | `accountId` |
| `get_answers_history` | 回答履歴取得 | `accountId` |
| `search_merge_requests` | MR/PR検索 | なし（全てオプション） |
| `get_user_profile` | ユーザープロファイル取得 | `accountId` |
| `get_growth_milestones` | 成長マイルストーン取得 | `accountId` |

## テストデータの投入

```bash
GOOGLE_CLOUD_PROJECT=your-gcp-project-id npx tsx scripts/seed-test-data.ts
```

詳細は [scripts/README.md](scripts/README.md) を参照。

## 開発

```bash
# 型チェック
npm run typecheck

# ビルド
npm run build

# 開発モード（直接実行）
GOOGLE_CLOUD_PROJECT=your-gcp-project-id npm run dev
```

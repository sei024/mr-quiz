# テストデータ管理スクリプト

## 概要

`seed-test-data.ts` は MCP 全7ツールの動作確認用テストデータを Firestore に投入・削除するスクリプト。
テストユーザー `test-user-mcp` を使用し、既存データには影響しない。

## コマンド

```bash
cd mr-quiz-mcp

# テストデータ投入（既存の test-user-mcp データがあれば自動削除してから再投入）
GOOGLE_CLOUD_PROJECT=your-gcp-project-id npx tsx scripts/seed-test-data.ts

# テストデータ削除のみ
GOOGLE_CLOUD_PROJECT=your-gcp-project-id npx tsx scripts/seed-test-data.ts --cleanup
```

## 投入データ一覧

| コレクション | 件数 | 内容 |
|---|---|---|
| `users` | 1 | test-user-mcp, platform: github, totalQuizzes: 15, correctCount: 10 |
| `userProfiles` | 1 | mid, 経験3年, focusAreas: security/performance |
| `mergeRequests` | 3 | test-org/test-repo #101(merged), #102(open), #103(merged) |
| `quizzes` | 5 | 各カテゴリ1つ: bug_fix(easy), performance(medium), refactoring(easy), security(hard), logic(medium) |
| `answers` | 15 | bug_fix: 2/3, performance: 1/3, refactoring: 3/3, security: 1/3, logic: 3/3 |
| `skillStats` | 5 | カテゴリ別統計。performance: declining, security: improving |
| `growthMilestones` | 3 | first_correct, total_milestone, category_master(refactoring) |

## テストシナリオ

シードデータ投入後、Claude Code 上で以下の MCP ツールを順に呼び出す。

### 1. `get_user_profile` — プロファイル取得

- accountId: `test-user-mcp`
- 期待: experienceLevel="mid", focusAreas=["security","performance"], selfAssessment あり

### 2. `get_user_stats` — 統計取得

- accountId: `test-user-mcp`
- 期待: totalQuizzes=15, correctCount=10, overallAccuracyRate=67
- categoryBreakdown: 5カテゴリすべて表示、skillStatsAvailable=true

### 3. `analyze_weak_categories` — 弱点分析

- accountId: `test-user-mcp`
- 期待: weakCategories に performance(33%, declining) と security(33%, improving)
- recommendations が生成されること

### 4. `get_growth_milestones` — 成長記録

- accountId: `test-user-mcp`
- 期待: 3件（first_correct, total_milestone, category_master）

### 5. `get_answers_history` — 回答履歴（フィルタ付き）

- accountId: `test-user-mcp`, category: security, incorrectOnly: true
- 期待: 2件の不正解

### 6. `query_quizzes` — クイズ検索

- accountId: `test-user-mcp`
- 期待: 5件（全カテゴリ）

### 7. `search_merge_requests` — MR検索

- authorAccountId: `test-user-mcp`
- 期待: 3件（test-org/test-repo）

## 必要な Firestore インデックス

以下の複合インデックスが必要（初回のみ）。エラーメッセージに含まれる URL をブラウザで開いて「保存」する。

| コレクション | フィールド | 用途 |
|---|---|---|
| `quizzes` | `accountId` ASC + `createdAt` DESC | query_quizzes(accountId) |
| `mergeRequests` | `authorAccountId` ASC + `createdAt` DESC | search_merge_requests(authorAccountId) |

## 特記事項

- スクリプトは **冪等** — 再実行すると既存データを削除してから再投入する
- Timestamp は `{ seconds, nanoseconds }` プレーンオブジェクト形式
- 回答は1日ずつずらして時系列を再現
- ADC（Application Default Credentials）認証が必要

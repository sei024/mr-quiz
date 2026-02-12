# ドキュメント

MR/PR Quiz Botのプロジェクトドキュメント集です。

## 📚 ドキュメント一覧

### [architecture.md](./architecture.md)

システムアーキテクチャの詳細説明

**主要セクション**:
- [システム構成図](./architecture.md#システム構成図)
  - [本番環境（Google Cloud + GitHub Actions）](./architecture.md#本番環境google-cloud--github-actions)
  - [ローカル開発環境](./architecture.md#ローカル開発環境)
- [インフラコンポーネント](./architecture.md#インフラコンポーネント)
  - [GitHub Actions（トリガー・連携層）](./architecture.md#1-github-actionsトリガー連携層)
  - [Workload Identity Federation（認証基盤）](./architecture.md#2-workload-identity-federation認証基盤)
  - [GitHub App（Bot認証）](./architecture.md#3-github-appbot認証)
  - [Cloud Run（APIサーバー）](./architecture.md#4-cloud-runapiサーバー)
  - [Firestore（データストア）](./architecture.md#5-firestoreデータストア)
  - [Vertex AI（Gemini API）](./architecture.md#6-vertex-aigemini-api)
  - [Secret Manager](./architecture.md#7-secret-manager)
- [処理フロー](./architecture.md#処理フロー)
  - [クイズ生成フロー（PR作成時）](./architecture.md#クイズ生成フローpr作成時)
  - [コマンド処理フロー（コメント時）](./architecture.md#コマンド処理フローコメント時)
- [デプロイメント](./architecture.md#デプロイメント)
- [セキュリティ](./architecture.md#セキュリティ)
- [コスト見積もり（月間100PR想定）](./architecture.md#コスト見積もり月間100pr想定)
- [監視・運用](./architecture.md#監視運用)
- [拡張性・将来計画](./architecture.md#拡張性将来計画)

### [hackason-rule.md](./hackason-rule.md)

4th Agentic AI Hackathon with Google Cloudのルール

**主要セクション**:
- [Overview](./hackason-rule.md#overview)
- [Schedule](./hackason-rule.md#schedule)
- [Prize Money](./hackason-rule.md#prize-money)
- [Eligibility](./hackason-rule.md#eligibility)
- [Required Development Conditions](./hackason-rule.md#required-development-conditions)
  - [Google Cloud Compute Products](./hackason-rule.md#google-cloud-compute-products-select-at-least-one)
  - [AI Technology](./hackason-rule.md#ai-technology-select-at-least-one)
- [Submission Requirements](./hackason-rule.md#submission-requirements)
- [Judging Criteria](./hackason-rule.md#judging-criteria)
- [Reference Links](./hackason-rule.md#reference-links)

---

## 🔗 関連リンク

- [プロジェクトREADME](../README.md) - プロジェクト全体の説明
- [CLAUDE.md](../CLAUDE.md) - 開発ガイドライン

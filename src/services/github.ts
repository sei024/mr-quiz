import { App } from "@octokit/app";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * GitHub APIサービス
 * PR差分取得、コメント投稿などの機能を提供
 */

let githubApp: App | null = null;

/**
 * GitHub Appインスタンスを取得（シングルトン）
 */
function getGitHubApp(): App {
	if (!env.BOT_APP_ID || !env.BOT_APP_PRIVATE_KEY) {
		throw new Error("GitHub App credentials not configured");
	}

	if (!githubApp) {
		githubApp = new App({
			appId: env.BOT_APP_ID,
			privateKey: env.BOT_APP_PRIVATE_KEY,
		});
	}

	return githubApp;
}

/**
 * Installation IDからOctokitインスタンスを取得
 * @param installationId GitHub App Installation ID
 * @returns Octokit instance
 */
/**
 * Installation IDからOctokitインスタンスを取得
 * @param installationId GitHub App Installation ID
 * @returns Octokit instance
 */
async function getOctokit(installationId: number) {
	const app = getGitHubApp();
	return await app.getInstallationOctokit(installationId);
}

/**
 * PR差分を取得
 * @param owner リポジトリオーナー
 * @param repo リポジトリ名
 * @param prNumber PR番号
 * @param installationId GitHub App Installation ID
 * @returns 差分テキスト
 */
export async function fetchPRDiff(
	owner: string,
	repo: string,
	prNumber: number,
	installationId: number,
): Promise<string> {
	logger.info(`Fetching PR diff: ${owner}/${repo}#${prNumber}`);

	try {
		const octokit = await getOctokit(installationId);

		// PR差分を取得（Accept: application/vnd.github.v3.diff）
		const response = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
			owner,
			repo,
			pull_number: prNumber,
			headers: {
				accept: "application/vnd.github.v3.diff",
			},
		});

		// レスポンスはdiff形式の文字列
		const diff = response.data as unknown as string;

		logger.info(`Successfully fetched PR diff: ${diff.length} characters`);
		return diff;
	} catch (error) {
		logger.error("Failed to fetch PR diff", { error, owner, repo, prNumber });
		throw new Error(`Failed to fetch PR diff: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * PRにコメントを投稿
 * @param owner リポジトリオーナー
 * @param repo リポジトリ名
 * @param prNumber PR番号
 * @param body コメント本文（Markdown）
 * @param installationId GitHub App Installation ID
 * @returns コメントID
 */
export async function postPRComment(
	owner: string,
	repo: string,
	prNumber: number,
	body: string,
	installationId: number,
): Promise<number> {
	logger.info(`Posting PR comment: ${owner}/${repo}#${prNumber}`);

	try {
		const octokit = await getOctokit(installationId);

		const response = await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
			owner,
			repo,
			issue_number: prNumber,
			body,
		});

		logger.info(`Successfully posted PR comment: ${response.data.id}`);
		return response.data.id;
	} catch (error) {
		logger.error("Failed to post PR comment", { error, owner, repo, prNumber });
		throw new Error(`Failed to post PR comment: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * PRコメントを更新
 * @param owner リポジトリオーナー
 * @param repo リポジトリ名
 * @param commentId コメントID
 * @param body 新しいコメント本文（Markdown）
 * @param installationId GitHub App Installation ID
 */
export async function updatePRComment(
	owner: string,
	repo: string,
	commentId: number,
	body: string,
	installationId: number,
): Promise<void> {
	logger.info(`Updating PR comment: ${owner}/${repo} comment#${commentId}`);

	try {
		const octokit = await getOctokit(installationId);

		await octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
			owner,
			repo,
			comment_id: commentId,
			body,
		});

		logger.info(`Successfully updated PR comment: ${commentId}`);
	} catch (error) {
		logger.error("Failed to update PR comment", { error, owner, repo, commentId });
		throw new Error(`Failed to update PR comment: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Sanitize AI-generated text to prevent markdown injection.
 * Removes hyperlinks, HTML tags, and image embeds that could be used for phishing.
 */
export function sanitizeAIOutput(text: string): string {
	return (
		text
			// Remove markdown links [text](url) → text
			.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
			// Remove raw URLs (http/https)
			.replace(/https?:\/\/\S+/g, "[URL removed]")
			// Remove HTML tags
			.replace(/<[^>]+>/g, "")
			// Remove markdown image embeds ![alt](url)
			.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
	);
}

/**
 * クイズコメントをフォーマット
 * @param quizId クイズID
 * @param questionText 問題文
 * @param category カテゴリ
 * @param difficulty 難易度
 * @param options 選択肢
 * @param quizUrl クイズ回答URL
 * @param showProfileGuide 初回ユーザー向けプロファイルガイドを表示するか
 * @returns フォーマット済みMarkdown
 */
export function formatQuizComment(
	quizId: string,
	questionText: string,
	category: string,
	difficulty: string,
	options: string[],
	quizUrl: string,
	showProfileGuide = false,
): string {
	const safeQuestionText = sanitizeAIOutput(questionText);
	const safeOptions = options.map((opt) => sanitizeAIOutput(opt));
	const optionsList = safeOptions.map((opt, i) => `${i + 1}. ${opt}`).join("\n");

	// プロファイルガイドセクション
	const profileGuideSection = showProfileGuide
		? `

---

### 🆕 初めての方へ

より最適なクイズを出題するために、プロファイル設定をお願いします（任意）：

\`\`\`
/profile experience=mid years=3 focus=security,performance
\`\`\`

**パラメータ:**
- \`experience\`: junior / mid / senior
- \`years\`: 経験年数（数値）
- \`focus\`: 注力分野（最大5つ、カンマ区切り）
  - bug_fix, performance, refactoring, security, logic
- \`goal\`: キャリア目標（文字列、省略可）

**例:**
\`\`\`
/profile experience=senior years=5 focus=performance,security goal="フルスタックエンジニアを目指しています"
\`\`\`

*設定したプロファイルは今後のクイズ出題に反映されます*`
		: "";

	return `## 🎯 MR Quiz が生成されました！

あなたの変更内容に基づいてクイズが生成されました。
コードレビュー前に理解度をチェックしましょう！

### 📝 クイズ内容
**カテゴリ:** ${category}
**難易度:** ${difficulty}

**問題:**
${safeQuestionText}

**選択肢:**
${optionsList}

### 💡 回答方法
このコメントに以下のフォーマットで返信してください：

\`\`\`
/answer 1 ${quizId}
\`\`\`

**重要:** Quiz ID（\`${quizId}\`）をコピーして、回答番号の後に貼り付けてください。${profileGuideSection}

---
*Quiz ID: \`${quizId}\`*
*MR Quiz Bot により自動生成*
`;
}

/**
 * エラーコメントをフォーマット
 * @param error エラーメッセージ
 * @returns フォーマット済みMarkdown
 */
export function formatErrorComment(error: string): string {
	return `## ⚠️ クイズ生成エラー

クイズの生成中にエラーが発生しました：

\`\`\`
${error}
\`\`\`

---
*MR Quiz Bot により自動生成*
`;
}

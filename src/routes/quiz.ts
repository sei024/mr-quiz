import { Hono } from "hono";
import { z } from "zod";
import { NotFoundError, ValidationError } from "../middleware/error.js";
import { webhookVerificationMiddleware } from "../middleware/webhook.js";
import {
	checkAndCreateMilestones,
	createAnswer,
	createMergeRequest,
	createQuiz,
	getOrCreateUser,
	getQuiz,
	getSkillStats,
	updateQuizStatus,
	updateSkillStats,
	updateUserStats,
} from "../services/firestore.js";
import { generateQuizFromDiff } from "../services/gemini.js";
import { PlatformSchema } from "../types/index.js";
import { logger } from "../utils/logger.js";

// T024-T025: クイズAPIエンドポイント

const quizRoutes = new Hono();

// Webhook署名検証（T027-1）
// WEBHOOK_SECRET未設定時はスキップ（ローカル開発用）
quizRoutes.use("*", webhookVerificationMiddleware);

// =============================================================================
// T024: クイズ生成API（POST /api/quiz/generate）
// =============================================================================

/** クイズ生成リクエストのスキーマ */
const GenerateQuizRequestSchema = z.object({
	platform: PlatformSchema,
	owner: z.string().min(1),
	repo: z.string().min(1),
	number: z.number().int().positive(),
	accountId: z.string().min(1),
	title: z.string().min(1).optional().default("Untitled"),
	diff: z.string().min(1).max(500_000),
	filesChanged: z.array(z.string()).optional(),
});

/** クイズ生成レスポンスの型 */
interface GenerateQuizResponse {
	quizId: string;
	mergeRequestId: string;
	questionText: string;
	category: string;
	difficulty: string;
	options: string[];
}

quizRoutes.post("/generate", async (c) => {
	// リクエストボディのパース
	const body = await c.req.json();

	// バリデーション
	const parseResult = GenerateQuizRequestSchema.safeParse(body);
	if (!parseResult.success) {
		throw new ValidationError(
			"Invalid request body",
			parseResult.error.flatten(),
		);
	}

	const input = parseResult.data;

	logger.info("Quiz generation requested", {
		platform: input.platform,
		owner: input.owner,
		repo: input.repo,
		number: input.number,
		accountId: input.accountId,
	});

	// ユーザーを取得または作成
	await getOrCreateUser({
		accountId: input.accountId,
		platform: input.platform,
	});

	// マージリクエストを作成
	const mergeRequest = await createMergeRequest({
		platform: input.platform,
		owner: input.owner,
		repo: input.repo,
		number: input.number,
		authorAccountId: input.accountId,
		title: input.title,
		filesChanged: input.filesChanged,
	});

	// Geminiでクイズを生成
	const generatedQuiz = await generateQuizFromDiff(input.diff);

	// Firestoreにクイズを保存
	const quiz = await createQuiz({
		mergeRequestId: mergeRequest.mergeRequestId,
		accountId: input.accountId,
		generatedQuiz,
	});

	const response: GenerateQuizResponse = {
		quizId: quiz.quizId,
		mergeRequestId: quiz.mergeRequestId,
		questionText: quiz.questionText,
		category: quiz.category,
		difficulty: quiz.difficulty,
		options: quiz.options,
	};

	logger.info("Quiz generated successfully", {
		quizId: quiz.quizId,
		mergeRequestId: mergeRequest.mergeRequestId,
	});

	return c.json(response, 201);
});

// =============================================================================
// T025: クイズ回答API（POST /api/quiz/:quizId/answer）
// =============================================================================

/** クイズ回答リクエストのスキーマ */
const AnswerQuizRequestSchema = z.object({
	accountId: z.string().min(1),
	selectedAnswerIndex: z.number().int().min(0).max(3),
});

/** クイズ回答レスポンスの型 */
interface AnswerQuizResponse {
	answerId: string;
	isCorrect: boolean;
	correctAnswerIndex: number;
	selectedAnswerIndex: number;
	explanation: string;
}

quizRoutes.post("/:quizId/answer", async (c) => {
	const quizId = c.req.param("quizId");

	// リクエストボディのパース
	const body = await c.req.json();

	// バリデーション
	const parseResult = AnswerQuizRequestSchema.safeParse(body);
	if (!parseResult.success) {
		throw new ValidationError(
			"Invalid request body",
			parseResult.error.flatten(),
		);
	}

	const input = parseResult.data;

	logger.info("Quiz answer submitted", {
		quizId,
		accountId: input.accountId,
		selectedAnswerIndex: input.selectedAnswerIndex,
	});

	// クイズを取得
	const quiz = await getQuiz(quizId);
	if (!quiz) {
		throw new NotFoundError("Quiz");
	}

	// 既に回答済みかチェック
	if (quiz.status === "answered") {
		throw new ValidationError("Quiz has already been answered");
	}

	// 回答を作成
	const answer = await createAnswer(
		{
			quizId,
			accountId: input.accountId,
			selectedAnswerIndex: input.selectedAnswerIndex,
		},
		quiz,
	);

	// クイズステータスを更新
	await updateQuizStatus(quizId, "answered");

	// ユーザー統計を更新
	await updateUserStats(input.accountId, answer.isCorrect);

	// スキル統計を更新
	await updateSkillStats({
		accountId: input.accountId,
		category: quiz.category,
		isCorrect: answer.isCorrect,
		difficulty: quiz.difficulty,
	});

	// 更新後のユーザー情報とスキル統計を取得
	const user = await getOrCreateUser({
		accountId: input.accountId,
		platform: "github", // プラットフォームは既存データから取得すべきだが、ここでは簡略化
	});
	const skillStats = await getSkillStats(input.accountId, quiz.category);

	// マイルストーン達成チェック
	await checkAndCreateMilestones(input.accountId, answer, user, skillStats);

	const response: AnswerQuizResponse = {
		answerId: answer.answerId,
		isCorrect: answer.isCorrect,
		correctAnswerIndex: quiz.correctAnswerIndex,
		selectedAnswerIndex: answer.selectedAnswerIndex,
		explanation: quiz.explanation,
	};

	logger.info("Quiz answered", {
		answerId: answer.answerId,
		quizId,
		isCorrect: answer.isCorrect,
	});

	return c.json(response);
});

export { quizRoutes };

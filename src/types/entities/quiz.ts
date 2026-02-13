import { z } from "zod";
import {
	CategorySchema,
	DifficultySchema,
	QuizStatusSchema,
	TimestampSchema,
} from "../index.js";

// T016: Quizエンティティ型定義

/**
 * クイズ
 */
export const QuizSchema = z.object({
	/** クイズID (PK, UUID) */
	quizId: z.string().uuid(),

	/** 対象PR/MR ID (FK) */
	mergeRequestId: z.string().min(1),

	/** 対象ユーザーID (FK) */
	accountId: z.string().min(1),

	/** 問題文 */
	questionText: z.string().min(1),

	/** カテゴリ */
	category: CategorySchema,

	/** 難易度 */
	difficulty: DifficultySchema,

	/** 選択肢（4つ） */
	options: z.array(z.string().min(1)).length(4),

	/** 正解インデックス (0-3) */
	correctAnswerIndex: z.number().int().min(0).max(3),

	/** 解説 */
	explanation: z.string().min(1),

	/** 対象diff箇所 */
	diffReference: z.string().nullish(),

	/** ステータス */
	status: QuizStatusSchema,

	/** 作成日時 */
	createdAt: TimestampSchema,
});

export type Quiz = z.infer<typeof QuizSchema>;

/** Gemini生成時のクイズデータ（ID・ステータス・タイムスタンプなし） */
export const GeneratedQuizSchema = z.object({
	questionText: z.string().min(1),
	category: CategorySchema,
	difficulty: DifficultySchema,
	options: z.array(z.string().min(1)).length(4),
	correctAnswerIndex: z.number().int().min(0).max(3),
	explanation: z.string().min(1),
	diffReference: z.string().nullish(),
});

export type GeneratedQuiz = z.infer<typeof GeneratedQuizSchema>;

/** クイズ作成時の入力型 */
export const CreateQuizInputSchema = z.object({
	mergeRequestId: z.string().min(1),
	accountId: z.string().min(1),
	generatedQuiz: GeneratedQuizSchema,
});

export type CreateQuizInput = z.infer<typeof CreateQuizInputSchema>;

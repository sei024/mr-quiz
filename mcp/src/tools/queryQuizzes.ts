import { z } from "zod";
import {
	CategorySchema,
	DifficultySchema,
	QuizStatusSchema,
} from "../../../src/types/index.js";
import { queryQuizzes } from "../services/firestore.js";
import { logger } from "../utils/logger.js";

export const queryQuizzesInputSchema = z.object({
	category: CategorySchema.optional().describe(
		"Filter by category: bug_fix, performance, refactoring, security, logic",
	),
	difficulty: DifficultySchema.optional().describe(
		"Filter by difficulty: easy, medium, hard",
	),
	status: QuizStatusSchema.optional().describe(
		"Filter by status: pending, answered, skipped, expired",
	),
	accountId: z.string().optional().describe("Filter by user account ID"),
	mergeRequestId: z.string().optional().describe("Filter by merge request ID"),
	limit: z
		.number()
		.int()
		.positive()
		.max(100)
		.optional()
		.describe("Maximum number of results (default: 50, max: 100)"),
});

export type QueryQuizzesInput = z.infer<typeof queryQuizzesInputSchema>;

export async function handleQueryQuizzes(input: QueryQuizzesInput) {
	logger.info("Executing query_quizzes", { input });

	const quizzes = await queryQuizzes({
		category: input.category,
		difficulty: input.difficulty,
		status: input.status,
		accountId: input.accountId,
		mergeRequestId: input.mergeRequestId,
		limit: input.limit ?? 50,
	});

	logger.info("query_quizzes completed", { count: quizzes.length });

	return {
		count: quizzes.length,
		quizzes: quizzes.map((q) => ({
			quizId: q.quizId,
			mergeRequestId: q.mergeRequestId,
			accountId: q.accountId,
			questionText: q.questionText,
			category: q.category,
			difficulty: q.difficulty,
			status: q.status,
			options: q.options,
			correctAnswerIndex: q.correctAnswerIndex,
			explanation: q.explanation,
			diffReference: q.diffReference,
			createdAt: q.createdAt,
		})),
	};
}

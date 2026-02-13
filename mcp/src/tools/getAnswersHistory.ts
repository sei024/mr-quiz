import { z } from "zod";
import { CategorySchema, DifficultySchema } from "../../../src/types/index.js";
import { getAnswersByUser, getUserById } from "../services/firestore.js";
import { logger } from "../utils/logger.js";

export const getAnswersHistoryInputSchema = z.object({
	accountId: z
		.string()
		.min(1)
		.describe("User account ID (GitHub/GitLab username)"),
	limit: z
		.number()
		.int()
		.positive()
		.max(100)
		.optional()
		.describe("Maximum number of results (default: 50, max: 100)"),
	category: CategorySchema.optional().describe(
		"Filter by category: bug_fix, performance, refactoring, security, logic",
	),
	difficulty: DifficultySchema.optional().describe(
		"Filter by difficulty: easy, medium, hard",
	),
	correctOnly: z
		.boolean()
		.optional()
		.describe("If true, only return correct answers"),
	incorrectOnly: z
		.boolean()
		.optional()
		.describe("If true, only return incorrect answers"),
});

export type GetAnswersHistoryInput = z.infer<
	typeof getAnswersHistoryInputSchema
>;

export async function handleGetAnswersHistory(input: GetAnswersHistoryInput) {
	logger.info("Executing get_answers_history", { accountId: input.accountId });

	const user = await getUserById(input.accountId);

	if (!user) {
		return {
			found: false,
			message: `User with accountId "${input.accountId}" not found`,
		};
	}

	let answers = await getAnswersByUser(input.accountId);

	// Apply filters
	if (input.category) {
		answers = answers.filter((a) => a.category === input.category);
	}

	if (input.difficulty) {
		answers = answers.filter((a) => a.difficulty === input.difficulty);
	}

	if (input.correctOnly) {
		answers = answers.filter((a) => a.isCorrect);
	} else if (input.incorrectOnly) {
		answers = answers.filter((a) => !a.isCorrect);
	}

	// Apply limit
	const limit = input.limit ?? 50;
	const limitedAnswers = answers.slice(0, limit);

	// Calculate summary stats
	const totalCorrect = limitedAnswers.filter((a) => a.isCorrect).length;
	const totalIncorrect = limitedAnswers.length - totalCorrect;

	logger.info("get_answers_history completed", {
		accountId: input.accountId,
		count: limitedAnswers.length,
	});

	return {
		found: true,
		accountId: input.accountId,
		totalReturned: limitedAnswers.length,
		totalInDatabase: answers.length,
		summary: {
			correct: totalCorrect,
			incorrect: totalIncorrect,
			accuracyRate:
				limitedAnswers.length > 0
					? Math.round((totalCorrect / limitedAnswers.length) * 100)
					: 0,
		},
		answers: limitedAnswers.map((a) => ({
			answerId: a.answerId,
			quizId: a.quizId,
			mergeRequestId: a.mergeRequestId,
			category: a.category,
			difficulty: a.difficulty,
			selectedAnswerIndex: a.selectedAnswerIndex,
			isCorrect: a.isCorrect,
			answeredAt: a.answeredAt,
		})),
	};
}

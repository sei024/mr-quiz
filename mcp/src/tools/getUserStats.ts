import { z } from "zod";
import {
	getAnswersByUser,
	getSkillStatsByUser,
	getUserById,
} from "../services/firestore.js";
import { logger } from "../utils/logger.js";

export const getUserStatsInputSchema = z.object({
	accountId: z
		.string()
		.min(1)
		.describe("User account ID (GitHub/GitLab username)"),
});

export type GetUserStatsInput = z.infer<typeof getUserStatsInputSchema>;

export async function handleGetUserStats(input: GetUserStatsInput) {
	logger.info("Executing get_user_stats", { accountId: input.accountId });

	const user = await getUserById(input.accountId);

	if (!user) {
		return {
			found: false,
			message: `User with accountId "${input.accountId}" not found`,
		};
	}

	// Get recent answers for detailed stats
	const recentAnswers = await getAnswersByUser(input.accountId, 100);

	// Try to get SkillStats for enhanced category breakdown
	const skillStats = await getSkillStatsByUser(input.accountId);

	// Calculate category-wise stats from answers (fallback)
	const categoryStats: Record<string, { total: number; correct: number }> = {};
	const difficultyStats: Record<string, { total: number; correct: number }> =
		{};

	for (const answer of recentAnswers) {
		// Category stats
		if (!categoryStats[answer.category]) {
			categoryStats[answer.category] = { total: 0, correct: 0 };
		}
		categoryStats[answer.category].total++;
		if (answer.isCorrect) {
			categoryStats[answer.category].correct++;
		}

		// Difficulty stats
		if (!difficultyStats[answer.difficulty]) {
			difficultyStats[answer.difficulty] = { total: 0, correct: 0 };
		}
		difficultyStats[answer.difficulty].total++;
		if (answer.isCorrect) {
			difficultyStats[answer.difficulty].correct++;
		}
	}

	// Calculate accuracy rates
	const formatStats = (
		stats: Record<string, { total: number; correct: number }>,
	) => {
		return Object.entries(stats).map(([key, value]) => ({
			name: key,
			total: value.total,
			correct: value.correct,
			accuracyRate:
				value.total > 0 ? Math.round((value.correct / value.total) * 100) : 0,
		}));
	};

	const overallAccuracyRate =
		user.totalQuizzes > 0
			? Math.round((user.correctCount / user.totalQuizzes) * 100)
			: 0;

	// Build enhanced category breakdown if SkillStats available
	let categoryBreakdown: ReturnType<typeof formatStats>;
	if (skillStats.length > 0) {
		categoryBreakdown = skillStats.map((ss) => ({
			name: ss.category,
			total: ss.totalQuizzes,
			correct: ss.correctCount,
			accuracyRate: Math.round(ss.correctRate * 100),
			weeklyTrend: ss.weeklyTrend,
			monthlyTrend: ss.monthlyTrend,
			averageDifficulty: ss.averageDifficulty,
		}));
	} else {
		categoryBreakdown = formatStats(categoryStats);
	}

	logger.info("get_user_stats completed", { accountId: input.accountId });

	return {
		found: true,
		user: {
			accountId: user.accountId,
			platform: user.platform,
			totalQuizzes: user.totalQuizzes,
			correctCount: user.correctCount,
			overallAccuracyRate,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		},
		categoryBreakdown,
		difficultyBreakdown: formatStats(difficultyStats),
		recentAnswersCount: recentAnswers.length,
		skillStatsAvailable: skillStats.length > 0,
	};
}

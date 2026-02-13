import { z } from "zod";
import type { Category } from "../../../src/types/index.js";
import {
	getAnswersByUser,
	getSkillStatsByUser,
	getUserById,
} from "../services/firestore.js";
import { logger } from "../utils/logger.js";

export const analyzeWeakCategoriesInputSchema = z.object({
	accountId: z
		.string()
		.min(1)
		.describe("User account ID (GitHub/GitLab username)"),
	minAnswers: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("Minimum answers in a category to consider (default: 3)"),
});

export type AnalyzeWeakCategoriesInput = z.infer<
	typeof analyzeWeakCategoriesInputSchema
>;

interface CategoryAnalysis {
	category: Category;
	totalAnswers: number;
	correctAnswers: number;
	incorrectAnswers: number;
	accuracyRate: number;
	recentTrend: "improving" | "declining" | "stable" | "insufficient_data";
}

export async function handleAnalyzeWeakCategories(
	input: AnalyzeWeakCategoriesInput,
) {
	logger.info("Executing analyze_weak_categories", {
		accountId: input.accountId,
	});

	const user = await getUserById(input.accountId);

	if (!user) {
		return {
			found: false,
			message: `User with accountId "${input.accountId}" not found`,
		};
	}

	const minAnswers = input.minAnswers ?? 3;

	// Try SkillStats first for enhanced analysis
	const skillStats = await getSkillStatsByUser(input.accountId);

	let analyses: CategoryAnalysis[];

	if (skillStats.length > 0) {
		// Use SkillStats for analysis (enhanced path)
		analyses = skillStats
			.filter((ss) => ss.totalQuizzes >= minAnswers)
			.map((ss) => {
				let recentTrend: CategoryAnalysis["recentTrend"];
				if (ss.weeklyTrend > 0.1) {
					recentTrend = "improving";
				} else if (ss.weeklyTrend < -0.1) {
					recentTrend = "declining";
				} else if (ss.monthlyTrend > 0.1) {
					recentTrend = "improving";
				} else if (ss.monthlyTrend < -0.1) {
					recentTrend = "declining";
				} else {
					recentTrend = "stable";
				}

				return {
					category: ss.category,
					totalAnswers: ss.totalQuizzes,
					correctAnswers: ss.correctCount,
					incorrectAnswers: ss.totalQuizzes - ss.correctCount,
					accuracyRate: Math.round(ss.correctRate * 100),
					recentTrend,
				};
			});
	} else {
		// Fallback: calculate from answers
		const answers = await getAnswersByUser(input.accountId);

		const categoryData: Record<
			Category,
			{
				answers: Array<{
					isCorrect: boolean;
					answeredAt: { seconds: number };
				}>;
			}
		> = {
			bug_fix: { answers: [] },
			performance: { answers: [] },
			refactoring: { answers: [] },
			security: { answers: [] },
			logic: { answers: [] },
		};

		for (const answer of answers) {
			categoryData[answer.category].answers.push({
				isCorrect: answer.isCorrect,
				answeredAt: answer.answeredAt,
			});
		}

		analyses = [];

		for (const [category, data] of Object.entries(categoryData)) {
			if (data.answers.length < minAnswers) {
				continue;
			}

			const totalAnswers = data.answers.length;
			const correctAnswers = data.answers.filter((a) => a.isCorrect).length;
			const accuracyRate = Math.round((correctAnswers / totalAnswers) * 100);

			// Calculate recent trend (last 5 vs previous 5)
			let recentTrend: CategoryAnalysis["recentTrend"] = "insufficient_data";

			if (data.answers.length >= 10) {
				const sortedAnswers = [...data.answers].sort(
					(a, b) => b.answeredAt.seconds - a.answeredAt.seconds,
				);

				const recentFive = sortedAnswers.slice(0, 5);
				const previousFive = sortedAnswers.slice(5, 10);

				const recentAccuracy = recentFive.filter((a) => a.isCorrect).length / 5;
				const previousAccuracy =
					previousFive.filter((a) => a.isCorrect).length / 5;

				if (recentAccuracy > previousAccuracy + 0.1) {
					recentTrend = "improving";
				} else if (recentAccuracy < previousAccuracy - 0.1) {
					recentTrend = "declining";
				} else {
					recentTrend = "stable";
				}
			}

			analyses.push({
				category: category as Category,
				totalAnswers,
				correctAnswers,
				incorrectAnswers: totalAnswers - correctAnswers,
				accuracyRate,
				recentTrend,
			});
		}
	}

	// Sort by accuracy rate (ascending) to show weakest first
	analyses.sort((a, b) => a.accuracyRate - b.accuracyRate);

	// Identify weak categories (below 60% accuracy)
	const weakCategories = analyses.filter((a) => a.accuracyRate < 60);

	// Generate recommendations
	const recommendations: string[] = [];

	for (const weak of weakCategories.slice(0, 3)) {
		if (weak.recentTrend === "declining") {
			recommendations.push(
				`${weak.category}: Accuracy is declining (${weak.accuracyRate}%). Focus on reviewing ${weak.category} concepts.`,
			);
		} else if (weak.recentTrend === "improving") {
			recommendations.push(
				`${weak.category}: Good progress! Continue practicing to improve from ${weak.accuracyRate}%.`,
			);
		} else {
			recommendations.push(
				`${weak.category}: Accuracy is ${weak.accuracyRate}%. Consider more practice in this area.`,
			);
		}
	}

	if (weakCategories.length === 0 && analyses.length > 0) {
		recommendations.push(
			"Great job! No significant weak areas detected. Keep up the good work!",
		);
	}

	logger.info("analyze_weak_categories completed", {
		accountId: input.accountId,
		weakCategoriesCount: weakCategories.length,
	});

	return {
		found: true,
		accountId: input.accountId,
		totalCategoriesAnalyzed: analyses.length,
		allCategories: analyses,
		weakCategories,
		recommendations,
		analysisNote: `Categories with fewer than ${minAnswers} answers are excluded from analysis.`,
		skillStatsAvailable: skillStats.length > 0,
	};
}

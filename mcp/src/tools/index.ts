import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	analyzeWeakCategoriesInputSchema,
	handleAnalyzeWeakCategories,
} from "./analyzeWeakCategories.js";
import {
	getAnswersHistoryInputSchema,
	handleGetAnswersHistory,
} from "./getAnswersHistory.js";
import {
	getGrowthMilestonesInputSchema,
	handleGetGrowthMilestones,
} from "./getGrowthMilestones.js";
import {
	getUserProfileInputSchema,
	handleGetUserProfile,
} from "./getUserProfile.js";
import { getUserStatsInputSchema, handleGetUserStats } from "./getUserStats.js";
import { handleQueryQuizzes, queryQuizzesInputSchema } from "./queryQuizzes.js";
import {
	handleSearchMergeRequests,
	searchMergeRequestsInputSchema,
} from "./searchMergeRequests.js";

/**
 * Register all MCP tools
 */
export function registerTools(server: McpServer): void {
	// query_quizzes - Search quizzes with filters
	server.tool(
		"query_quizzes",
		"Search quizzes by category, difficulty, status, user, or merge request. Returns quiz data including questions, options, and explanations.",
		queryQuizzesInputSchema.shape,
		async (params) => {
			const input = queryQuizzesInputSchema.parse(params);
			const result = await handleQueryQuizzes(input);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	// get_user_stats - Get user statistics
	server.tool(
		"get_user_stats",
		"Get comprehensive statistics for a user including total quizzes, accuracy rates, and breakdowns by category and difficulty.",
		getUserStatsInputSchema.shape,
		async (params) => {
			const input = getUserStatsInputSchema.parse(params);
			const result = await handleGetUserStats(input);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	// analyze_weak_categories - Analyze user's weak areas
	server.tool(
		"analyze_weak_categories",
		"Analyze a user's weak categories based on their answer history. Identifies areas needing improvement and provides recommendations.",
		analyzeWeakCategoriesInputSchema.shape,
		async (params) => {
			const input = analyzeWeakCategoriesInputSchema.parse(params);
			const result = await handleAnalyzeWeakCategories(input);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	// get_answers_history - Get user's answer history
	server.tool(
		"get_answers_history",
		"Get a user's answer history with optional filters for category, difficulty, and correctness. Useful for detailed learning analysis.",
		getAnswersHistoryInputSchema.shape,
		async (params) => {
			const input = getAnswersHistoryInputSchema.parse(params);
			const result = await handleGetAnswersHistory(input);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	// search_merge_requests - Search merge requests
	server.tool(
		"search_merge_requests",
		"Search merge requests (PRs/MRs) by platform, repository, author, or status. Returns MR metadata including titles and file changes.",
		searchMergeRequestsInputSchema.shape,
		async (params) => {
			const input = searchMergeRequestsInputSchema.parse(params);
			const result = await handleSearchMergeRequests(input);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	// get_user_profile - Get user profile
	server.tool(
		"get_user_profile",
		"Get a user's profile including career goals, experience level, focus areas, and self-assessment.",
		getUserProfileInputSchema.shape,
		async (params) => {
			const input = getUserProfileInputSchema.parse(params);
			const result = await handleGetUserProfile(input);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	// get_growth_milestones - Get user's growth milestones
	server.tool(
		"get_growth_milestones",
		"Get a user's growth milestones including achievements like first correct answer, category mastery, and streak records.",
		getGrowthMilestonesInputSchema.shape,
		async (params) => {
			const input = getGrowthMilestonesInputSchema.parse(params);
			const result = await handleGetGrowthMilestones(input);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);
}

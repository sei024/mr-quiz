import { z } from "zod";
import {
	MergeRequestStatusSchema,
	PlatformSchema,
} from "../../../src/types/index.js";
import { queryMergeRequests } from "../services/firestore.js";
import { logger } from "../utils/logger.js";

export const searchMergeRequestsInputSchema = z.object({
	platform: PlatformSchema.optional().describe(
		"Filter by platform: github or gitlab",
	),
	owner: z.string().optional().describe("Filter by repository owner"),
	repo: z.string().optional().describe("Filter by repository name"),
	authorAccountId: z
		.string()
		.optional()
		.describe("Filter by author account ID"),
	status: MergeRequestStatusSchema.optional().describe(
		"Filter by status: open, merged, closed",
	),
	limit: z
		.number()
		.int()
		.positive()
		.max(100)
		.optional()
		.describe("Maximum number of results (default: 50, max: 100)"),
});

export type SearchMergeRequestsInput = z.infer<
	typeof searchMergeRequestsInputSchema
>;

export async function handleSearchMergeRequests(
	input: SearchMergeRequestsInput,
) {
	logger.info("Executing search_merge_requests", { input });

	const mergeRequests = await queryMergeRequests({
		platform: input.platform,
		owner: input.owner,
		repo: input.repo,
		authorAccountId: input.authorAccountId,
		status: input.status,
		limit: input.limit ?? 50,
	});

	// Group by repository for summary
	const repoSummary: Record<string, number> = {};
	for (const mr of mergeRequests) {
		const repoKey = `${mr.owner}/${mr.repo}`;
		repoSummary[repoKey] = (repoSummary[repoKey] ?? 0) + 1;
	}

	logger.info("search_merge_requests completed", {
		count: mergeRequests.length,
	});

	return {
		count: mergeRequests.length,
		repositorySummary: Object.entries(repoSummary).map(([repo, count]) => ({
			repository: repo,
			count,
		})),
		mergeRequests: mergeRequests.map((mr) => ({
			mergeRequestId: mr.mergeRequestId,
			platform: mr.platform,
			owner: mr.owner,
			repo: mr.repo,
			number: mr.number,
			authorAccountId: mr.authorAccountId,
			title: mr.title,
			status: mr.status,
			diffSummary: mr.diffSummary,
			filesChanged: mr.filesChanged,
			createdAt: mr.createdAt,
		})),
	};
}

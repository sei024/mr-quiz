import { z } from "zod";
import { getGrowthMilestonesByUser } from "../services/firestore.js";
import { logger } from "../utils/logger.js";

export const getGrowthMilestonesInputSchema = z.object({
	accountId: z
		.string()
		.min(1)
		.describe("User account ID (GitHub/GitLab username)"),
	limit: z
		.number()
		.int()
		.min(1)
		.max(100)
		.optional()
		.describe("Maximum number of milestones to return (default: 50)"),
});

export type GetGrowthMilestonesInput = z.infer<
	typeof getGrowthMilestonesInputSchema
>;

export async function handleGetGrowthMilestones(
	input: GetGrowthMilestonesInput,
) {
	logger.info("Executing get_growth_milestones", {
		accountId: input.accountId,
	});

	const limit = input.limit ?? 50;
	const milestones = await getGrowthMilestonesByUser(input.accountId, limit);

	logger.info("get_growth_milestones completed", {
		accountId: input.accountId,
		count: milestones.length,
	});

	return {
		accountId: input.accountId,
		count: milestones.length,
		milestones: milestones.map((m) => ({
			milestoneId: m.milestoneId,
			type: m.type,
			category: m.category,
			achievement: m.achievement,
			metadata: m.metadata,
			achievedAt: m.achievedAt,
		})),
	};
}

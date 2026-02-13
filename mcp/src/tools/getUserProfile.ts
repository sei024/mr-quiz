import { z } from "zod";
import { getUserProfile } from "../services/firestore.js";
import { logger } from "../utils/logger.js";

export const getUserProfileInputSchema = z.object({
	accountId: z
		.string()
		.min(1)
		.describe("User account ID (GitHub/GitLab username)"),
});

export type GetUserProfileInput = z.infer<typeof getUserProfileInputSchema>;

export async function handleGetUserProfile(input: GetUserProfileInput) {
	logger.info("Executing get_user_profile", { accountId: input.accountId });

	const profile = await getUserProfile(input.accountId);

	if (!profile) {
		return {
			found: false,
			message: `User profile for accountId "${input.accountId}" not found`,
		};
	}

	logger.info("get_user_profile completed", { accountId: input.accountId });

	return {
		found: true,
		profile: {
			accountId: profile.accountId,
			careerGoal: profile.careerGoal,
			experienceLevel: profile.experienceLevel,
			yearsOfExperience: profile.yearsOfExperience,
			focusAreas: profile.focusAreas,
			selfAssessment: profile.selfAssessment,
			createdAt: profile.createdAt,
			updatedAt: profile.updatedAt,
		},
	};
}

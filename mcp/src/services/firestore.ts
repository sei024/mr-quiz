import { Firestore } from "@google-cloud/firestore";
import type { Answer } from "../../../src/types/entities/answer.js";
import type { GrowthMilestone } from "../../../src/types/entities/growthMilestone.js";
import type { MergeRequest } from "../../../src/types/entities/mergeRequest.js";
import type { Quiz } from "../../../src/types/entities/quiz.js";
import type { SkillStats } from "../../../src/types/entities/skillStats.js";
import type { User } from "../../../src/types/entities/user.js";
import type { UserProfile } from "../../../src/types/entities/userProfile.js";
import type {
	Category,
	Difficulty,
	MergeRequestStatus,
	Platform,
	QuizStatus,
} from "../../../src/types/index.js";
import { env, isEmulator } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Firestoreクライアント（遅延初期化）
let firestoreInstance: Firestore | null = null;

export function getFirestore(): Firestore {
	if (firestoreInstance) {
		return firestoreInstance;
	}

	if (isEmulator()) {
		logger.info("Connecting to Firestore Emulator", {
			host: env.FIRESTORE_EMULATOR_HOST,
		});
	}

	firestoreInstance = new Firestore({
		projectId: env.GOOGLE_CLOUD_PROJECT,
		ignoreUndefinedProperties: true,
	});

	return firestoreInstance;
}

// コレクション名定数
export const Collections = {
	USERS: "users",
	QUIZZES: "quizzes",
	ANSWERS: "answers",
	MERGE_REQUESTS: "mergeRequests",
	USER_PROFILES: "userProfiles",
	SKILL_STATS: "skillStats",
	GROWTH_MILESTONES: "growthMilestones",
} as const;

// コレクション参照取得ヘルパー
export function getUsersCollection() {
	return getFirestore().collection(Collections.USERS);
}

export function getQuizzesCollection() {
	return getFirestore().collection(Collections.QUIZZES);
}

export function getAnswersCollection() {
	return getFirestore().collection(Collections.ANSWERS);
}

export function getMergeRequestsCollection() {
	return getFirestore().collection(Collections.MERGE_REQUESTS);
}

export function getUserProfilesCollection() {
	return getFirestore().collection(Collections.USER_PROFILES);
}

export function getSkillStatsCollection() {
	return getFirestore().collection(Collections.SKILL_STATS);
}

export function getGrowthMilestonesCollection() {
	return getFirestore().collection(Collections.GROWTH_MILESTONES);
}

// =============================================================================
// 読み取り専用クエリ関数
// =============================================================================

/**
 * ユーザーを取得する
 */
export async function getUserById(accountId: string): Promise<User | null> {
	const doc = await getUsersCollection().doc(accountId).get();

	if (!doc.exists) {
		return null;
	}

	return doc.data() as User;
}

/**
 * ユーザーの回答履歴を取得する
 */
export async function getAnswersByUser(
	accountId: string,
	limit?: number,
): Promise<Answer[]> {
	let query = getAnswersCollection()
		.where("accountId", "==", accountId)
		.orderBy("answeredAt", "desc");

	if (limit) {
		query = query.limit(limit);
	}

	const snapshot = await query.get();
	return snapshot.docs.map((doc) => doc.data() as Answer);
}

/**
 * クイズ検索オプション
 */
export interface QueryQuizzesOptions {
	category?: Category;
	difficulty?: Difficulty;
	status?: QuizStatus;
	accountId?: string;
	mergeRequestId?: string;
	limit?: number;
}

/**
 * クイズを検索する
 */
export async function queryQuizzes(
	options: QueryQuizzesOptions = {},
): Promise<Quiz[]> {
	let query: FirebaseFirestore.Query = getQuizzesCollection();

	if (options.category) {
		query = query.where("category", "==", options.category);
	}

	if (options.difficulty) {
		query = query.where("difficulty", "==", options.difficulty);
	}

	if (options.status) {
		query = query.where("status", "==", options.status);
	}

	if (options.accountId) {
		query = query.where("accountId", "==", options.accountId);
	}

	if (options.mergeRequestId) {
		query = query.where("mergeRequestId", "==", options.mergeRequestId);
	}

	query = query.orderBy("createdAt", "desc");

	if (options.limit) {
		query = query.limit(options.limit);
	}

	const snapshot = await query.get();
	return snapshot.docs.map((doc) => doc.data() as Quiz);
}

/**
 * マージリクエスト検索オプション
 */
export interface QueryMergeRequestsOptions {
	platform?: Platform;
	owner?: string;
	repo?: string;
	authorAccountId?: string;
	status?: MergeRequestStatus;
	limit?: number;
}

/**
 * マージリクエストを検索する
 */
export async function queryMergeRequests(
	options: QueryMergeRequestsOptions = {},
): Promise<MergeRequest[]> {
	let query: FirebaseFirestore.Query = getMergeRequestsCollection();

	if (options.platform) {
		query = query.where("platform", "==", options.platform);
	}

	if (options.owner) {
		query = query.where("owner", "==", options.owner);
	}

	if (options.repo) {
		query = query.where("repo", "==", options.repo);
	}

	if (options.authorAccountId) {
		query = query.where("authorAccountId", "==", options.authorAccountId);
	}

	if (options.status) {
		query = query.where("status", "==", options.status);
	}

	query = query.orderBy("createdAt", "desc");

	if (options.limit) {
		query = query.limit(options.limit);
	}

	const snapshot = await query.get();
	return snapshot.docs.map((doc) => doc.data() as MergeRequest);
}

/**
 * クイズを取得する
 */
export async function getQuizById(quizId: string): Promise<Quiz | null> {
	const doc = await getQuizzesCollection().doc(quizId).get();

	if (!doc.exists) {
		return null;
	}

	return doc.data() as Quiz;
}

/**
 * マージリクエストを取得する
 */
export async function getMergeRequestById(
	mergeRequestId: string,
): Promise<MergeRequest | null> {
	const doc = await getMergeRequestsCollection().doc(mergeRequestId).get();

	if (!doc.exists) {
		return null;
	}

	return doc.data() as MergeRequest;
}

/**
 * ユーザープロファイルを取得する
 */
export async function getUserProfile(
	accountId: string,
): Promise<UserProfile | null> {
	const doc = await getUserProfilesCollection().doc(accountId).get();

	if (!doc.exists) {
		return null;
	}

	return doc.data() as UserProfile;
}

/**
 * ユーザーのスキル統計を全カテゴリ分取得する
 */
export async function getSkillStatsByUser(
	accountId: string,
): Promise<SkillStats[]> {
	const snapshot = await getSkillStatsCollection()
		.where("accountId", "==", accountId)
		.get();

	return snapshot.docs.map((doc) => doc.data() as SkillStats);
}

/**
 * ユーザーの成長マイルストーンを取得する
 */
export async function getGrowthMilestonesByUser(
	accountId: string,
	limit?: number,
): Promise<GrowthMilestone[]> {
	let query = getGrowthMilestonesCollection()
		.where("accountId", "==", accountId)
		.orderBy("achievedAt", "desc");

	if (limit) {
		query = query.limit(limit);
	}

	const snapshot = await query.get();
	return snapshot.docs.map((doc) => doc.data() as GrowthMilestone);
}

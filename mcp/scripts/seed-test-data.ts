/**
 * テストデータ投入用シードスクリプト
 *
 * Usage:
 *   npx tsx scripts/seed-test-data.ts           # データ投入
 *   npx tsx scripts/seed-test-data.ts --cleanup  # データ削除
 */

import { Firestore } from "@google-cloud/firestore";
import { randomUUID } from "node:crypto";

// ===== 設定 =====
const ACCOUNT_ID = "test-user-mcp";
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;

if (!PROJECT_ID) {
	console.error("ERROR: GOOGLE_CLOUD_PROJECT environment variable is required");
	process.exit(1);
}

const db = new Firestore({
	projectId: PROJECT_ID,
	ignoreUndefinedProperties: true,
});

// コレクション名
const Collections = {
	USERS: "users",
	QUIZZES: "quizzes",
	ANSWERS: "answers",
	MERGE_REQUESTS: "mergeRequests",
	USER_PROFILES: "userProfiles",
	SKILL_STATS: "skillStats",
	GROWTH_MILESTONES: "growthMilestones",
} as const;

// ===== ヘルパー =====

/** 基準時刻から N 日前の Timestamp を生成 */
function daysAgo(n: number): { seconds: number; nanoseconds: number } {
	const ms = Date.now() - n * 24 * 60 * 60 * 1000;
	return { seconds: Math.floor(ms / 1000), nanoseconds: 0 };
}

/** 現在の Timestamp */
function now(): { seconds: number; nanoseconds: number } {
	return { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 };
}

// ===== クリーンアップ =====

async function cleanup() {
	console.log(`Cleaning up data for ${ACCOUNT_ID}...`);

	const collections = [
		{ name: Collections.USERS, field: null, isDocId: true },
		{ name: Collections.USER_PROFILES, field: null, isDocId: true },
		{ name: Collections.QUIZZES, field: "accountId", isDocId: false },
		{ name: Collections.ANSWERS, field: "accountId", isDocId: false },
		{ name: Collections.MERGE_REQUESTS, field: "authorAccountId", isDocId: false },
		{ name: Collections.SKILL_STATS, field: "accountId", isDocId: false },
		{ name: Collections.GROWTH_MILESTONES, field: "accountId", isDocId: false },
	];

	for (const col of collections) {
		let snapshot: FirebaseFirestore.QuerySnapshot;

		if (col.isDocId) {
			const doc = await db.collection(col.name).doc(ACCOUNT_ID).get();
			if (doc.exists) {
				await doc.ref.delete();
				console.log(`  Deleted ${col.name}/${ACCOUNT_ID}`);
			} else {
				console.log(`  ${col.name}/${ACCOUNT_ID} not found, skipping`);
			}
			continue;
		}

		snapshot = await db
			.collection(col.name)
			.where(col.field!, "==", ACCOUNT_ID)
			.get();

		if (snapshot.empty) {
			console.log(`  ${col.name}: 0 docs`);
			continue;
		}

		const batch = db.batch();
		for (const doc of snapshot.docs) {
			batch.delete(doc.ref);
		}
		await batch.commit();
		console.log(`  ${col.name}: deleted ${snapshot.size} docs`);
	}

	console.log("Cleanup complete!");
}

// ===== シードデータ投入 =====

async function seed() {
	// 冪等性: まず既存データを削除
	await cleanup();
	console.log("\nSeeding test data...\n");

	const ts = now();

	// ----- 1. User -----
	const user = {
		accountId: ACCOUNT_ID,
		platform: "github",
		totalQuizzes: 15,
		correctCount: 10,
		createdAt: daysAgo(30),
		updatedAt: ts,
	};
	await db.collection(Collections.USERS).doc(ACCOUNT_ID).set(user);
	console.log("[1/7] User created");

	// ----- 2. UserProfile -----
	const profile = {
		accountId: ACCOUNT_ID,
		careerGoal: "セキュリティに強いバックエンドエンジニアになりたい",
		experienceLevel: "mid",
		yearsOfExperience: 3,
		focusAreas: ["security", "performance"],
		selfAssessment: {
			bug_fix: 3,
			performance: 2,
			refactoring: 4,
			security: 2,
			logic: 3,
		},
		createdAt: daysAgo(30),
		updatedAt: ts,
	};
	await db.collection(Collections.USER_PROFILES).doc(ACCOUNT_ID).set(profile);
	console.log("[2/7] UserProfile created");

	// ----- 3. MergeRequests x 3 -----
	const mergeRequests = [
		{
			mergeRequestId: "github_test-org_test-repo_101",
			platform: "github",
			owner: "test-org",
			repo: "test-repo",
			number: 101,
			authorAccountId: ACCOUNT_ID,
			title: "feat: Add user authentication middleware",
			diffSummary: "JWT認証ミドルウェアの追加",
			filesChanged: ["src/middleware/auth.ts", "src/routes/api.ts"],
			status: "merged",
			createdAt: daysAgo(20),
		},
		{
			mergeRequestId: "github_test-org_test-repo_102",
			platform: "github",
			owner: "test-org",
			repo: "test-repo",
			number: 102,
			authorAccountId: ACCOUNT_ID,
			title: "fix: Resolve N+1 query in user listing",
			diffSummary: "ユーザー一覧のN+1クエリを修正",
			filesChanged: ["src/services/userService.ts", "src/repositories/userRepo.ts"],
			status: "open",
			createdAt: daysAgo(5),
		},
		{
			mergeRequestId: "github_test-org_test-repo_103",
			platform: "github",
			owner: "test-org",
			repo: "test-repo",
			number: 103,
			authorAccountId: ACCOUNT_ID,
			title: "refactor: Extract validation logic into shared module",
			diffSummary: "バリデーションロジックを共通モジュールに切り出し",
			filesChanged: ["src/utils/validation.ts", "src/controllers/userController.ts"],
			status: "merged",
			createdAt: daysAgo(10),
		},
	];

	const mrBatch = db.batch();
	for (const mr of mergeRequests) {
		mrBatch.set(
			db.collection(Collections.MERGE_REQUESTS).doc(mr.mergeRequestId),
			mr,
		);
	}
	await mrBatch.commit();
	console.log("[3/7] MergeRequests x 3 created");

	// ----- 4. Quizzes x 5 -----
	type QuizDef = {
		category: string;
		difficulty: string;
		mrId: string;
		questionText: string;
		options: string[];
		correctAnswerIndex: number;
		explanation: string;
	};

	const quizDefs: QuizDef[] = [
		{
			category: "bug_fix",
			difficulty: "easy",
			mrId: "github_test-org_test-repo_101",
			questionText:
				"認証ミドルウェアでトークンが無効な場合、どのHTTPステータスコードを返すべきですか？",
			options: ["200 OK", "401 Unauthorized", "403 Forbidden", "500 Internal Server Error"],
			correctAnswerIndex: 1,
			explanation: "無効なトークンの場合は401 Unauthorizedを返すのが適切です。",
		},
		{
			category: "performance",
			difficulty: "medium",
			mrId: "github_test-org_test-repo_102",
			questionText: "N+1クエリ問題を解決するために最も適切な手法はどれですか？",
			options: ["キャッシュの追加", "JOINまたはバッチクエリ", "インデックス作成", "接続プール増加"],
			correctAnswerIndex: 1,
			explanation: "N+1問題はJOINやバッチクエリでリレーションを一括取得することで解決します。",
		},
		{
			category: "refactoring",
			difficulty: "easy",
			mrId: "github_test-org_test-repo_103",
			questionText: "共通モジュールに切り出す際、最も重要な原則はどれですか？",
			options: ["DRY原則", "YAGNI原則", "KISS原則", "SRP（単一責任の原則）"],
			correctAnswerIndex: 3,
			explanation:
				"共通モジュール化ではSRP（単一責任の原則）に従い、明確な責務を持たせることが重要です。",
		},
		{
			category: "security",
			difficulty: "hard",
			mrId: "github_test-org_test-repo_101",
			questionText: "JWTトークンの署名検証で、最もセキュアなアルゴリズムはどれですか？",
			options: ["HS256", "RS256", "none", "HS384"],
			correctAnswerIndex: 1,
			explanation: "RS256は非対称鍵を使用し、秘密鍵の共有が不要なため最もセキュアです。",
		},
		{
			category: "logic",
			difficulty: "medium",
			mrId: "github_test-org_test-repo_102",
			questionText:
				"ページネーション実装で、offset方式と比較したcursor方式の利点はどれですか？",
			options: [
				"実装が簡単",
				"大量データでもパフォーマンスが安定",
				"ランダムアクセスが可能",
				"SQLの標準機能で対応可能",
			],
			correctAnswerIndex: 1,
			explanation:
				"cursor方式はoffsetのスキップが不要なため、大量データでもパフォーマンスが安定します。",
		},
	];

	const quizIds: string[] = [];
	const quizBatch = db.batch();
	for (let i = 0; i < quizDefs.length; i++) {
		const def = quizDefs[i];
		const quizId = randomUUID();
		quizIds.push(quizId);

		quizBatch.set(db.collection(Collections.QUIZZES).doc(quizId), {
			quizId,
			mergeRequestId: def.mrId,
			accountId: ACCOUNT_ID,
			questionText: def.questionText,
			category: def.category,
			difficulty: def.difficulty,
			options: def.options,
			correctAnswerIndex: def.correctAnswerIndex,
			explanation: def.explanation,
			status: "answered",
			createdAt: daysAgo(15 - i),
		});
	}
	await quizBatch.commit();
	console.log("[4/7] Quizzes x 5 created");

	// ----- 5. Answers x 15 -----
	// カテゴリ別: bug_fix(2/3), performance(1/3), refactoring(3/3), security(1/3), logic(3/3)
	type AnswerDef = {
		category: string;
		difficulty: string;
		quizIndex: number;
		isCorrect: boolean;
		mrId: string;
	};

	const answerDefs: AnswerDef[] = [
		// bug_fix: 3問 (2正解, 1不正解)
		{ category: "bug_fix", difficulty: "easy", quizIndex: 0, isCorrect: true, mrId: "github_test-org_test-repo_101" },
		{ category: "bug_fix", difficulty: "easy", quizIndex: 0, isCorrect: true, mrId: "github_test-org_test-repo_101" },
		{ category: "bug_fix", difficulty: "medium", quizIndex: 0, isCorrect: false, mrId: "github_test-org_test-repo_101" },
		// performance: 3問 (1正解, 2不正解)
		{ category: "performance", difficulty: "medium", quizIndex: 1, isCorrect: true, mrId: "github_test-org_test-repo_102" },
		{ category: "performance", difficulty: "medium", quizIndex: 1, isCorrect: false, mrId: "github_test-org_test-repo_102" },
		{ category: "performance", difficulty: "hard", quizIndex: 1, isCorrect: false, mrId: "github_test-org_test-repo_102" },
		// refactoring: 3問 (3正解)
		{ category: "refactoring", difficulty: "easy", quizIndex: 2, isCorrect: true, mrId: "github_test-org_test-repo_103" },
		{ category: "refactoring", difficulty: "easy", quizIndex: 2, isCorrect: true, mrId: "github_test-org_test-repo_103" },
		{ category: "refactoring", difficulty: "medium", quizIndex: 2, isCorrect: true, mrId: "github_test-org_test-repo_103" },
		// security: 3問 (1正解, 2不正解)
		{ category: "security", difficulty: "hard", quizIndex: 3, isCorrect: true, mrId: "github_test-org_test-repo_101" },
		{ category: "security", difficulty: "hard", quizIndex: 3, isCorrect: false, mrId: "github_test-org_test-repo_101" },
		{ category: "security", difficulty: "medium", quizIndex: 3, isCorrect: false, mrId: "github_test-org_test-repo_101" },
		// logic: 3問 (3正解)
		{ category: "logic", difficulty: "medium", quizIndex: 4, isCorrect: true, mrId: "github_test-org_test-repo_102" },
		{ category: "logic", difficulty: "medium", quizIndex: 4, isCorrect: true, mrId: "github_test-org_test-repo_102" },
		{ category: "logic", difficulty: "hard", quizIndex: 4, isCorrect: true, mrId: "github_test-org_test-repo_102" },
	];

	const answerBatch = db.batch();
	for (let i = 0; i < answerDefs.length; i++) {
		const def = answerDefs[i];
		const answerId = randomUUID();
		const quiz = quizDefs[def.quizIndex];

		answerBatch.set(db.collection(Collections.ANSWERS).doc(answerId), {
			answerId,
			quizId: quizIds[def.quizIndex],
			accountId: ACCOUNT_ID,
			mergeRequestId: def.mrId,
			selectedAnswerIndex: def.isCorrect ? quiz.correctAnswerIndex : (quiz.correctAnswerIndex + 1) % 4,
			isCorrect: def.isCorrect,
			category: def.category,
			difficulty: def.difficulty,
			answeredAt: daysAgo(15 - i),
		});
	}
	await answerBatch.commit();
	console.log("[5/7] Answers x 15 created");

	// ----- 6. SkillStats x 5 -----
	const skillStatsDefs = [
		{
			category: "bug_fix",
			totalQuizzes: 3,
			correctCount: 2,
			correctRate: 0.67,
			averageDifficulty: 1.33,
			weeklyTrend: 0.1,
			monthlyTrend: 0.1,
		},
		{
			category: "performance",
			totalQuizzes: 3,
			correctCount: 1,
			correctRate: 0.33,
			averageDifficulty: 2.33,
			weeklyTrend: -0.3,
			monthlyTrend: -0.2,
		},
		{
			category: "refactoring",
			totalQuizzes: 3,
			correctCount: 3,
			correctRate: 1.0,
			averageDifficulty: 1.33,
			weeklyTrend: 0.5,
			monthlyTrend: 0.4,
		},
		{
			category: "security",
			totalQuizzes: 3,
			correctCount: 1,
			correctRate: 0.33,
			averageDifficulty: 2.67,
			weeklyTrend: 0.0,
			monthlyTrend: 0.2,
		},
		{
			category: "logic",
			totalQuizzes: 3,
			correctCount: 3,
			correctRate: 1.0,
			averageDifficulty: 2.33,
			weeklyTrend: 0.3,
			monthlyTrend: 0.3,
		},
	];

	const statsBatch = db.batch();
	for (const def of skillStatsDefs) {
		const statId = randomUUID();
		statsBatch.set(db.collection(Collections.SKILL_STATS).doc(statId), {
			statId,
			accountId: ACCOUNT_ID,
			category: def.category,
			totalQuizzes: def.totalQuizzes,
			correctCount: def.correctCount,
			correctRate: def.correctRate,
			averageDifficulty: def.averageDifficulty,
			lastAnsweredAt: daysAgo(1),
			weeklyTrend: def.weeklyTrend,
			monthlyTrend: def.monthlyTrend,
			calculatedAt: ts,
		});
	}
	await statsBatch.commit();
	console.log("[6/7] SkillStats x 5 created");

	// ----- 7. GrowthMilestones x 3 -----
	const milestones = [
		{
			type: "first_correct",
			achievement: "初めての正解を達成！",
			achievedAt: daysAgo(15),
			metadata: { quizId: quizIds[0] },
		},
		{
			type: "total_milestone",
			achievement: "累計10問回答達成",
			achievedAt: daysAgo(5),
			metadata: { totalAnswers: 10 },
		},
		{
			type: "category_master",
			category: "refactoring",
			achievement: "refactoringマスター達成",
			achievedAt: daysAgo(2),
			metadata: { correctRate: 1.0, totalQuizzes: 3 },
		},
	];

	const milestoneBatch = db.batch();
	for (const ms of milestones) {
		const milestoneId = randomUUID();
		milestoneBatch.set(
			db.collection(Collections.GROWTH_MILESTONES).doc(milestoneId),
			{
				milestoneId,
				accountId: ACCOUNT_ID,
				type: ms.type,
				...(ms.category ? { category: ms.category } : {}),
				achievement: ms.achievement,
				metadata: ms.metadata,
				achievedAt: ms.achievedAt,
			},
		);
	}
	await milestoneBatch.commit();
	console.log("[7/7] GrowthMilestones x 3 created");

	console.log("\nSeed complete! Test user:", ACCOUNT_ID);
	console.log("Summary:");
	console.log("  - User: 1");
	console.log("  - UserProfile: 1");
	console.log("  - MergeRequests: 3");
	console.log("  - Quizzes: 5");
	console.log("  - Answers: 15 (10 correct, 5 incorrect)");
	console.log("  - SkillStats: 5");
	console.log("  - GrowthMilestones: 3");
}

// ===== メイン =====

const isCleanup = process.argv.includes("--cleanup");

if (isCleanup) {
	cleanup()
		.then(() => process.exit(0))
		.catch((err) => {
			console.error("Cleanup failed:", err);
			process.exit(1);
		});
} else {
	seed()
		.then(() => process.exit(0))
		.catch((err) => {
			console.error("Seed failed:", err);
			process.exit(1);
		});
}

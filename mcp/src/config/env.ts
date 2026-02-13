import { z } from "zod";

// 環境変数管理モジュール（MCP用）
// MCPサーバーではdotenvは使用せず、環境変数は直接process.envから取得

const EnvSchema = z.object({
	/** Google Cloud Project ID */
	GOOGLE_CLOUD_PROJECT: z.string().min(1),

	/** Firestore Emulator Host (ローカル開発用) */
	FIRESTORE_EMULATOR_HOST: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
	const result = EnvSchema.safeParse(process.env);

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;
		const missing = Object.entries(errors)
			.map(([key, msgs]) => `  ${key}: ${msgs?.join(", ")}`)
			.join("\n");
		throw new Error(`Missing or invalid environment variables:\n${missing}`);
	}

	return result.data;
}

export const env = loadEnv();

/** Emulator使用中かどうか */
export const isEmulator = (): boolean => !!env.FIRESTORE_EMULATOR_HOST;

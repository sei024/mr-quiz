import {
	type GenerativeModel,
	type Schema,
	SchemaType,
	VertexAI,
} from "@google-cloud/vertexai";
import { env } from "../config/env.js";
import {
	type GeneratedQuiz,
	GeneratedQuizSchema,
} from "../types/entities/quiz.js";
import { logger } from "../utils/logger.js";

// T012: Vertex AI クライアント初期化

let vertexAI: VertexAI | null = null;
let model: GenerativeModel | null = null;

const MODEL_NAME = "gemini-2.5-flash";
const LOCATION = "asia-northeast1";

export function getVertexAIClient(): VertexAI {
	if (vertexAI) {
		return vertexAI;
	}

	vertexAI = new VertexAI({
		project: env.GOOGLE_CLOUD_PROJECT,
		location: LOCATION,
	});
	logger.info("Vertex AI client initialized", {
		project: env.GOOGLE_CLOUD_PROJECT,
		location: LOCATION,
	});

	return vertexAI;
}

export function getGeminiModel(): GenerativeModel {
	if (model) {
		return model;
	}

	model = getVertexAIClient().getGenerativeModel({ model: MODEL_NAME });
	logger.info("Gemini model initialized", { model: MODEL_NAME });

	return model;
}

// =============================================================================
// T023: クイズ生成メソッド
// =============================================================================

/** クイズ生成用のJSON Schema */
const quizResponseSchema: Schema = {
	type: SchemaType.OBJECT,
	properties: {
		questionText: {
			type: SchemaType.STRING,
			description: "The quiz question text",
		},
		category: {
			type: SchemaType.STRING,
			description:
				"Category of the quiz: bug_fix, performance, refactoring, security, or logic",
			enum: ["bug_fix", "performance", "refactoring", "security", "logic"],
			format: "enum",
		},
		difficulty: {
			type: SchemaType.STRING,
			description: "Difficulty level: easy, medium, or hard",
			enum: ["easy", "medium", "hard"],
			format: "enum",
		},
		options: {
			type: SchemaType.ARRAY,
			description: "Four answer options",
			items: { type: SchemaType.STRING },
		},
		correctAnswerIndex: {
			type: SchemaType.INTEGER,
			description: "Index of the correct answer (0-3)",
		},
		explanation: {
			type: SchemaType.STRING,
			description: "Explanation of why the correct answer is correct",
		},
		diffReference: {
			type: SchemaType.STRING,
			description:
				"Reference to the specific part of the diff this quiz is about",
			nullable: true,
		},
	},
	required: [
		"questionText",
		"category",
		"difficulty",
		"options",
		"correctAnswerIndex",
		"explanation",
	],
};

/** クイズ生成用のシステムプロンプト */
const QUIZ_SYSTEM_PROMPT = `あなたはコードレビューの専門家です。
与えられたdiff（差分）を分析し、その変更内容に関するクイズを1問作成してください。

## クイズ作成のルール
1. 問題文は変更の意図や効果について問う内容にしてください
2. 選択肢は4つ作成し、1つだけ正解にしてください
3. 解説では、なぜその回答が正しいのか、他の選択肢がなぜ間違っているのかを説明してください
4. カテゴリは以下から最も適切なものを選んでください:
   - bug_fix: バグ修正に関する変更
   - performance: パフォーマンス改善に関する変更
   - refactoring: リファクタリングに関する変更
   - security: セキュリティに関する変更
   - logic: ビジネスロジックに関する変更
5. 難易度は以下から選んでください:
   - easy: 基本的な知識で回答できる
   - medium: 中程度の理解が必要
   - hard: 深い理解や経験が必要

## 重要
- 日本語で作成してください
- 選択肢は必ず4つにしてください
- 正解インデックスは0から3の範囲で指定してください`;

/**
 * diffからクイズを生成する
 */
export async function generateQuizFromDiff(
	diff: string,
): Promise<GeneratedQuiz> {
	logger.info("Initializing Gemini model", { modelName: MODEL_NAME });

	const model = getVertexAIClient().getGenerativeModel({
		model: MODEL_NAME,
		generationConfig: {
			responseMimeType: "application/json",
			responseSchema: quizResponseSchema,
		},
	});

	const prompt = `${QUIZ_SYSTEM_PROMPT}

## 分析対象のdiff
\`\`\`diff
${diff}
\`\`\`

Analyze the diff above and create one quiz in the following JSON format.
Write questionText, options, and explanation in Japanese.
Use exact English values for category and difficulty as shown below.

{
  "questionText": "問題文",
  "category": "bug_fix | performance | refactoring | security | logic",
  "difficulty": "easy | medium | hard",
  "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
  "correctAnswerIndex": 0,
  "explanation": "解説文",
  "diffReference": "該当する差分の参照（任意）"
}

Output only the JSON (no explanatory text).`;

	logger.info("Generating quiz from diff", {
		diffLength: diff.length,
		modelName: MODEL_NAME,
		project: env.GOOGLE_CLOUD_PROJECT,
	});

	try {
		logger.debug("Calling Vertex AI Gemini API...");
		const result = await model.generateContent(prompt);
		logger.debug("Vertex AI Gemini API call completed");

		const response = result.response;
		const text =
			response.candidates?.[0]?.content?.parts?.[0]?.text ||
			JSON.stringify(response);

		logger.debug("Gemini response", { text });

		// JSONブロックから抽出（```json ... ``` で囲まれている場合に対応）
		let jsonText = text.trim();
		const jsonMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
		if (jsonMatch) {
			jsonText = jsonMatch[1].trim();
		}

		const parsed = JSON.parse(jsonText);
		const validated = GeneratedQuizSchema.parse(parsed);

		logger.info("Quiz generated successfully", {
			category: validated.category,
			difficulty: validated.difficulty,
		});

		return validated;
	} catch (error) {
		logger.error("Vertex AI Gemini API error details", {
			error,
			errorType: error?.constructor?.name,
			errorCode: (error as any)?.code,
			errorDetails: (error as any)?.details,
			errorStatus: (error as any)?.status,
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			modelName: MODEL_NAME,
			project: env.GOOGLE_CLOUD_PROJECT,
		});
		throw error;
	}
}

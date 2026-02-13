#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { logger } from "./utils/logger.js";

const SERVER_NAME = "mr-quiz-mcp";
const SERVER_VERSION = "1.0.0";

async function main(): Promise<void> {
	logger.info("Starting MCP server", {
		name: SERVER_NAME,
		version: SERVER_VERSION,
	});

	// Create MCP server
	const server = new McpServer({
		name: SERVER_NAME,
		version: SERVER_VERSION,
	});

	// Register tools
	registerTools(server);

	logger.info("Tools registered", {
		tools: [
			"query_quizzes",
			"get_user_stats",
			"analyze_weak_categories",
			"get_answers_history",
			"search_merge_requests",
			"get_user_profile",
			"get_growth_milestones",
		],
	});

	// Create stdio transport
	const transport = new StdioServerTransport();

	// Connect server to transport
	await server.connect(transport);

	logger.info("MCP server connected and ready");
}

// Handle process signals
process.on("SIGINT", () => {
	logger.info("Received SIGINT, shutting down");
	process.exit(0);
});

process.on("SIGTERM", () => {
	logger.info("Received SIGTERM, shutting down");
	process.exit(0);
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
	logger.error("Uncaught exception", { error: String(error) });
	process.exit(1);
});

process.on("unhandledRejection", (reason) => {
	logger.error("Unhandled rejection", { reason: String(reason) });
	process.exit(1);
});

// Start server
main().catch((error) => {
	logger.error("Failed to start server", { error: String(error) });
	process.exit(1);
});

// MCPサーバー用ロガー
// 重要: stdoutはMCPプロトコル専用のため、ログはすべてstderrへ出力

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	data?: Record<string, unknown>;
}

function formatLog(
	level: LogLevel,
	message: string,
	data?: Record<string, unknown>,
): string {
	const entry: LogEntry = {
		timestamp: new Date().toISOString(),
		level,
		message,
	};

	if (data && Object.keys(data).length > 0) {
		entry.data = data;
	}

	return JSON.stringify(entry);
}

function writeToStderr(content: string): void {
	process.stderr.write(`${content}\n`);
}

export const logger = {
	debug(message: string, data?: Record<string, unknown>): void {
		writeToStderr(formatLog("debug", message, data));
	},

	info(message: string, data?: Record<string, unknown>): void {
		writeToStderr(formatLog("info", message, data));
	},

	warn(message: string, data?: Record<string, unknown>): void {
		writeToStderr(formatLog("warn", message, data));
	},

	error(message: string, data?: Record<string, unknown>): void {
		writeToStderr(formatLog("error", message, data));
	},
};

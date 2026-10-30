import "server-only";
import pino from "pino";
export type Log = Pick<pino.Logger, "debug" | "info" | "warn" | "error">;
export async function getLogger(
  bindings: Record<string, unknown> = {},
): Promise<Log> {
  const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: [
        "req.headers.authorization",
        "*.password",
        "*.apiKey",
        "*.token",
        "*.secret",
      ],
      censor: "[REDACTED]",
    },
    base: { service: "synapse", ...bindings },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  return logger;
}

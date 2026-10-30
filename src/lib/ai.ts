import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { Log } from "./logger";

export type AiErrorCategory =
  | "not_configured"
  | "timeout"
  | "rate_limit"
  | "provider"
  | "invalid_output"
  | "unknown";

export class AiError extends Error {
  constructor(
    public category: AiErrorCategory,
    public userMessage: string,
    cause?: unknown,
  ) {
    super(`${category}: ${userMessage}`, { cause });
    this.name = "AiError";
  }
}

const FRIENDLY: Record<AiErrorCategory, string> = {
  not_configured:
    "Gemini AI is not configured on this server. You can still create everything manually.",
  timeout:
    "The AI service took too long to respond. Please try again, or continue manually.",
  rate_limit:
    "The AI service is busy right now. Wait a moment and try again, or continue manually.",
  provider:
    "The AI service returned an error. Please try again, or continue manually.",
  invalid_output:
    "The AI response couldn't be validated. Please try again, or continue manually.",
  unknown:
    "Something went wrong while contacting the AI service. You can continue manually.",
};

export const aiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

function categorize(err: unknown): AiErrorCategory {
  if (err instanceof AiError) return err.category;

  const error = err as {
    status?: number;
    code?: number | string;
    message?: string;
    name?: string;
  };

  const message = (error?.message ?? "").toLowerCase();
  const status = Number(error?.status ?? error?.code);

  if (
    error?.name === "TimeoutError" ||
    error?.name === "AbortError" ||
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return "timeout";
  }

  if (
    status === 429 ||
    message.includes("resource_exhausted") ||
    message.includes("rate limit") ||
    message.includes("quota")
  ) {
    return "rate_limit";
  }

  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    message.includes("api key") ||
    message.includes("permission denied") ||
    message.includes("invalid argument")
  ) {
    return "provider";
  }

  if (status >= 500) return "provider";

  return "unknown";
}

const retryable = (category: AiErrorCategory) =>
  category === "timeout" ||
  category === "rate_limit" ||
  category === "provider" ||
  category === "invalid_output";

interface Opts<S extends z.ZodType> {
  operation: string;
  system: string;
  user: string;
  schema: S;
  log: Log;
  maxTokens?: number;
}

/**
 * Generates a structured response using Google Gemini.
 * The response is validated against the supplied Zod schema.
 * Transient failures and invalid outputs receive bounded retries.
 */
export async function generateStructured<S extends z.ZodType>(
  options: Opts<S>,
): Promise<z.infer<S>> {
  const started = Date.now();
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  if (!aiConfigured()) {
    options.log.warn({
      event: "ai.request.failure",
      operation: options.operation,
      errorCategory: "not_configured",
      latencyMs: 0,
    });

    throw new AiError("not_configured", FRIENDLY.not_configured);
  }

  const client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const maxAttempts = Math.max(1, Number(process.env.AI_MAX_ATTEMPTS ?? 2));

  const { $schema: omittedSchema, ...inputSchema } = z.toJSONSchema(
    options.schema,
  ) as Record<string, unknown>;

  void omittedSchema;

  let lastCategory: AiErrorCategory = "unknown";
  let feedback = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      options.log.debug({
        event: "ai.request.start",
        operation: options.operation,
        attempt,
        model,
      });

      const response = await client.models.generateContent({
        model,
        contents: options.user + feedback,
        config: {
          systemInstruction: options.system,
          responseMimeType: "application/json",
          responseJsonSchema: inputSchema,
          maxOutputTokens: options.maxTokens ?? 4096,
        },
      });

      const responseText = response.text;

      if (!responseText) {
        throw new AiError("invalid_output", FRIENDLY.invalid_output);
      }

      let output: unknown;

      try {
        output = JSON.parse(responseText);
      } catch (parseError) {
        feedback =
          "\n\nYour previous output was not valid JSON. Return only valid JSON matching the required schema.";

        throw new AiError(
          "invalid_output",
          FRIENDLY.invalid_output,
          parseError,
        );
      }

      const parsed = options.schema.safeParse(output);

      if (!parsed.success) {
        feedback =
          "\n\nYour previous output failed validation: " +
          parsed.error.issues
            .slice(0, 5)
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ") +
          ". Return corrected JSON.";

        throw new AiError(
          "invalid_output",
          FRIENDLY.invalid_output,
          parsed.error,
        );
      }

      options.log.info({
        event: "ai.request.success",
        operation: options.operation,
        success: true,
        latencyMs: Date.now() - started,
        attempts: attempt,
        model,
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      });

      return parsed.data;
    } catch (error) {
      lastCategory = categorize(error);

      options.log.warn({
        event: "ai.request.attempt_failed",
        operation: options.operation,
        attempt,
        errorCategory: lastCategory,
        errorMessage:
          error instanceof Error ? error.message.slice(0, 200) : "unknown",
      });

      if (!retryable(lastCategory) || attempt === maxAttempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }

  options.log.error({
    event: "ai.request.failure",
    operation: options.operation,
    success: false,
    latencyMs: Date.now() - started,
    errorCategory: lastCategory,
    model,
  });

  throw new AiError(lastCategory, FRIENDLY[lastCategory]);
}

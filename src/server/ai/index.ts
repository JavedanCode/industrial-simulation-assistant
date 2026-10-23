import { getConfig } from "../../config.js";
import { AppError } from "../http/appError.js";
import { createGeminiAiProvider } from "./geminiAiProvider.js";
import { mockAiProvider } from "./mockAiProvider.js";
import { createOllamaAiProvider } from "./ollamaAiProvider.js";
import type { AiProvider } from "./types.js";

/**
 * Select the implementation once per request. Keeping this switch explicit
 * makes it obvious which external service, if any, receives report data.
 */
export function getAiProvider(): AiProvider {
  const config = getConfig();

  switch (config.aiProvider) {
    case "mock":
      return mockAiProvider;

    case "gemini": {
      if (!config.geminiApiKey) {
        throw new AppError(
          500,
          "GEMINI_API_KEY is not configured. Set it in .env or use AI_PROVIDER=mock.",
          "AI_PROVIDER_NOT_CONFIGURED",
        );
      }

      return createGeminiAiProvider({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        timeoutMs: config.geminiTimeoutMs,
      });
    }

    case "ollama":
      return createOllamaAiProvider({
        baseUrl: config.ollamaBaseUrl,
        model: config.ollamaModel,
        timeoutMs: config.ollamaTimeoutMs,
      });

    default:
      throw new AppError(
        500,
        `The AI provider "${config.aiProvider}" is not supported.`,
        "AI_PROVIDER_UNSUPPORTED",
      );
  }
}

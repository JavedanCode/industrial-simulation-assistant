import { getConfig } from "../../config.js";
import { AppError } from "../http/appError.js";
import { mockAiProvider } from "./mockAiProvider.js";
import type { AiProvider } from "./types.js";

export function getAiProvider(): AiProvider {
  const { aiProvider } = getConfig();

  switch (aiProvider) {
    case "mock":
      return mockAiProvider;
    default:
      throw new AppError(
        500,
        `The AI provider "${aiProvider}" is not supported.`,
        "AI_PROVIDER_UNSUPPORTED",
      );
  }
}

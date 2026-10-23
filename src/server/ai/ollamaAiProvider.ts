import { AppError } from "../http/appError.js";
import { buildGroundedPrompt } from "./promptBuilder.js";
import type { AiGenerationInput, AiProvider } from "./types.js";

/**
 * Ollama runs a local LLM (e.g. via `ollama serve`). The backend talks to it over
 * HTTP on the same machine or LAN. No API key is required and nothing leaves
 * the local network.
 *
 * We use Ollama's OpenAI-compatible chat completions endpoint because it's
 * stable, easy to test with a fake fetch, and works with most models.
 */
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";
export const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b-instruct";
export const DEFAULT_OLLAMA_TIMEOUT_MS = 60_000;

interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatCompletionResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  error?: {
    message?: string;
  };
}

export interface OllamaAiProviderOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  /**
   * Injectable for offline tests. Production uses Node's built-in fetch.
   */
  fetchImpl?: typeof fetch;
}

/**
 * Convert the provider-neutral conversation into OpenAI-style chat messages.
 *
 * System instruction goes first, then history (user/assistant mapped as-is),
 * then the current question as the final user message.
 */
function buildOllamaMessages(
  prompt: ReturnType<typeof buildGroundedPrompt>,
): OllamaChatMessage[] {
  const messages: OllamaChatMessage[] = [
    {
      role: "system",
      content: prompt.systemInstruction,
    },
  ];

  for (const message of prompt.history) {
    // Both roles are already "user" or "assistant" in our schema
    messages.push({
      role: message.role,
      content: message.content,
    });
  }

  messages.push({
    role: "user",
    content: prompt.question,
  });

  return messages;
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

/**
 * Build an Ollama-backed provider for local inference.
 *
 * A factory is used instead of a module-level singleton so tests can inject a
 * fake `fetch` and run the full request/response path without Ollama running.
 */
export function createOllamaAiProvider(
  options: OllamaAiProviderOptions = {},
): AiProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_OLLAMA_BASE_URL).replace(
    /\/+$/,
    "",
  );
  const model = options.model ?? DEFAULT_OLLAMA_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_OLLAMA_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = `${baseUrl}/chat/completions`;

  return {
    name: "ollama",

    async generateReply(input: AiGenerationInput): Promise<string> {
      const prompt = buildGroundedPrompt(input);

      const requestBody = {
        model,
        messages: buildOllamaMessages(prompt),
        temperature: 0.2,
        max_tokens: 2048,
        stream: false,
      };

      let response: Response;

      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (isTimeoutError(error)) {
          throw new AppError(
            504,
            "Ollama did not respond within the configured timeout. Is Ollama running?",
            "AI_PROVIDER_TIMEOUT",
          );
        }

        throw new AppError(
          502,
          "Could not reach Ollama. Make sure Ollama is running and accessible.",
          "AI_PROVIDER_UNAVAILABLE",
        );
      }

      if (!response.ok) {
        let apiMessage: string | null = null;

        try {
          const body = (await response.json()) as OllamaChatCompletionResponse;
          apiMessage = body.error?.message ?? null;
        } catch {
          // ignore parse errors
        }

        if (response.status === 404) {
          return Promise.reject(
            new AppError(
              502,
              `Ollama model "${model}" was not found. Pull it with: ollama pull ${model}`,
              "AI_PROVIDER_MODEL_NOT_FOUND",
            ),
          );
        }

        if (response.status === 503 || response.status >= 500) {
          return Promise.reject(
            new AppError(
              502,
              "Ollama is temporarily unavailable.",
              "AI_PROVIDER_UNAVAILABLE",
            ),
          );
        }

        return Promise.reject(
          new AppError(
            502,
            apiMessage
              ? `Ollama request failed: ${apiMessage}`
              : "Ollama could not complete the request.",
            "AI_PROVIDER_REQUEST_FAILED",
          ),
        );
      }

      let payload: OllamaChatCompletionResponse | null;

      try {
        payload = (await response.json()) as OllamaChatCompletionResponse | null;
      } catch {
        throw new AppError(
          502,
          "Ollama returned an unreadable response.",
          "AI_PROVIDER_INVALID_RESPONSE",
        );
      }

      const text = payload?.choices?.[0]?.message?.content?.trim();

      if (!text) {
        throw new AppError(
          502,
          "Ollama returned an empty response.",
          "AI_PROVIDER_EMPTY_RESPONSE",
        );
      }

      return text;
    },
  };
}

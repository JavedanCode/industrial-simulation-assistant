import { AppError } from "../http/appError.js";
import { buildGroundedPrompt } from "./promptBuilder.js";
import type { AiGenerationInput, AiProvider } from "./types.js";

/**
 * A hosted Gemini model keeps the whole project free to run for one local user:
 * the backend does all report parsing and metric calculation, and the model only
 * turns those facts into readable explanations.
 *
 * The API key never leaves the backend. In particular, it is sent in a header
 * rather than in the request URL so it is less likely to appear in logs.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DEFAULT_GEMINI_TIMEOUT_MS = 30_000;

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiPart {
  text?: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
  };
}

export interface GeminiAiProviderOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  /**
   * Injectable for offline tests. Production uses Node's built-in fetch.
   */
  fetchImpl?: typeof fetch;
}

const BLOCKED_FINISH_REASONS = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "IMAGE_SAFETY",
]);

/**
 * Convert the provider-neutral conversation into Gemini's turn format.
 *
 * Gemini calls assistant turns "model", and its REST interface wants content
 * objects with a role plus one or more parts. Consecutive messages from the same
 * role are merged because a failed previous request can leave two user messages
 * next to each other in the stored conversation.
 */
function buildGeminiContents(
  prompt: ReturnType<typeof buildGroundedPrompt>,
): GeminiContent[] {
  const contents: GeminiContent[] = [];

  const append = (role: GeminiContent["role"], text: string) => {
    if (text.trim().length === 0) {
      return;
    }

    const previous = contents.at(-1);

    if (previous?.role === role) {
      const previousText = previous.parts[0]?.text ?? "";
      previous.parts = [{ text: `${previousText}\n\n${text}` }];
      return;
    }

    contents.push({
      role,
      parts: [{ text }],
    });
  };

  for (const message of prompt.history) {
    append(message.role === "assistant" ? "model" : "user", message.content);
  }

  append("user", prompt.question);

  return contents;
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

/**
 * Map provider failures to stable API errors without exposing the API key,
 * request prompt, or Google's raw error payload to the browser.
 */
function createGeminiHttpError(status: number): AppError {
  if (status === 401 || status === 403) {
    return new AppError(
      502,
      "Gemini rejected the API key or account permissions. Check GEMINI_API_KEY.",
      "AI_PROVIDER_AUTH_FAILED",
    );
  }

  if (status === 404) {
    return new AppError(
      502,
      "The configured Gemini model was not found. Check GEMINI_MODEL.",
      "AI_PROVIDER_MODEL_NOT_FOUND",
    );
  }

  if (status === 429) {
    return new AppError(
      503,
      "Gemini's free-tier rate limit was reached. Wait a moment and try again.",
      "AI_PROVIDER_RATE_LIMITED",
    );
  }

  if (status >= 500) {
    return new AppError(
      502,
      "Gemini is temporarily unavailable. Try again shortly.",
      "AI_PROVIDER_UNAVAILABLE",
    );
  }

  if (status === 400) {
    return new AppError(
      502,
      "Gemini rejected the request. Check the API key, model name, and account access.",
      "AI_PROVIDER_REQUEST_REJECTED",
    );
  }

  return new AppError(
    502,
    "Gemini could not complete the request.",
    "AI_PROVIDER_REQUEST_FAILED",
  );
}

/**
 * Build a Gemini-backed provider.
 *
 * A factory is used instead of a module-level singleton so tests can inject a
 * fake `fetch` and run the full request/response path without a real key or
 * network connection.
 */
export function createGeminiAiProvider(
  options: GeminiAiProviderOptions,
): AiProvider {
  const apiKey = options.apiKey.trim();

  if (apiKey.length === 0) {
    throw new AppError(
      500,
      "GEMINI_API_KEY is not configured. Set it in .env or use AI_PROVIDER=mock.",
      "AI_PROVIDER_NOT_CONFIGURED",
    );
  }

  // Accept either "gemini-3.8-flash" or "models/gemini-3.8-flash" so a pasted
  // model identifier works without editing it first.
  const model = (options.model ?? DEFAULT_GEMINI_MODEL).replace(/^models\//, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`;

  return {
    name: "gemini",

    async generateReply(input: AiGenerationInput): Promise<string> {
      const prompt = buildGroundedPrompt(input);

      // The report context and grounding rules travel in systemInstruction.
      // Conversation turns remain in `contents`, exactly as a stateless chat
      // completion API expects them.
      const requestBody = {
        systemInstruction: {
          parts: [{ text: prompt.systemInstruction }],
        },
        contents: buildGeminiContents(prompt),
        generationConfig: {
          // Low temperature keeps answers close to the supplied report facts.
          temperature: 0.2,
          // Gemini 3 models think before answering. "LOW" is enough for report
          // explanation and leaves room in the output budget for the answer.
          // Thinking tokens count toward maxOutputTokens, so keep this above
          // the length of a normal chat reply.
          maxOutputTokens: 4_096,
          thinkingConfig: {
            thinkingLevel: "LOW",
          },
        },
      };

      let response: Response;

      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (isTimeoutError(error)) {
          throw new AppError(
            504,
            "Gemini did not respond within the configured timeout.",
            "AI_PROVIDER_TIMEOUT",
          );
        }

        throw new AppError(
          502,
          "Could not reach Gemini. Check the internet connection and try again.",
          "AI_PROVIDER_UNAVAILABLE",
        );
      }

      if (!response.ok) {
        // The response body can contain implementation details. The public
        // error only keeps the useful, stable category (auth, rate limit, etc.).
        throw createGeminiHttpError(response.status);
      }

      let payload: GeminiResponse | null;

      try {
        payload = (await response.json()) as GeminiResponse | null;
      } catch {
        throw new AppError(
          502,
          "Gemini returned an unreadable response.",
          "AI_PROVIDER_INVALID_RESPONSE",
        );
      }

      const candidate = payload?.candidates?.[0];
      const text = (candidate?.content?.parts ?? [])
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("")
        .trim();

      if (text.length === 0) {
        const blockReason = payload?.promptFeedback?.blockReason;

        if (
          blockReason ||
          (candidate?.finishReason
            ? BLOCKED_FINISH_REASONS.has(candidate.finishReason)
            : false)
        ) {
          throw new AppError(
            502,
            "Gemini blocked the response. Try rephrasing the question.",
            "AI_RESPONSE_BLOCKED",
          );
        }

        throw new AppError(
          502,
          "Gemini returned an empty response.",
          "AI_PROVIDER_EMPTY_RESPONSE",
        );
      }

      return text;
    },
  };
}

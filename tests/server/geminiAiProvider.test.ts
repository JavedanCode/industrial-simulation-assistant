import { describe, expect, it } from "vitest";
import {
  createGeminiAiProvider,
  type GeminiAiProviderOptions,
} from "../../src/server/ai/geminiAiProvider.js";
import { AppError } from "../../src/server/http/appError.js";
import { createTestAiInput } from "../helpers/createAiInput.js";

interface GeminiRequestBody {
  systemInstruction: {
    parts: Array<{ text: string }>;
  };
  contents: Array<{
    role: "user" | "model";
    parts: Array<{ text: string }>;
  }>;
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    thinkingConfig: {
      thinkingLevel: string;
    };
  };
}

interface CapturedRequest {
  url: string;
  init: RequestInit;
  body: GeminiRequestBody;
}

function createCapturingFetch(payload: unknown, status = 200) {
  let captured: CapturedRequest | null = null;

  const fetchImpl = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    captured = {
      url: String(url),
      init: init ?? {},
      body: JSON.parse(String(init?.body)) as GeminiRequestBody,
    };

    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  return {
    fetchImpl,
    request(): CapturedRequest {
      if (!captured) {
        throw new Error("The provider did not call fetch.");
      }

      return captured;
    },
  };
}

function createProvider(
  fetchImpl: typeof fetch,
  overrides: Partial<GeminiAiProviderOptions> = {},
) {
  return createGeminiAiProvider({
    apiKey: "test-key",
    model: "models/gemini-test-model",
    timeoutMs: 5_000,
    fetchImpl,
    ...overrides,
  });
}

describe("Gemini AI provider", () => {
  it("sends grounded context, conversation history, and the API key header", async () => {
    const input = await createTestAiInput({
      history: [
        { role: "user", content: "Earlier question" },
        { role: "assistant", content: "Earlier answer" },
      ],
    });
    const mock = createCapturingFetch({
      candidates: [
        {
          content: {
            parts: [{ text: "Grounded " }, { text: "answer." }],
          },
        },
      ],
    });

    const reply = await createProvider(mock.fetchImpl).generateReply(input);
    const request = mock.request();
    const headers = new Headers(request.init.headers);

    expect(reply).toBe("Grounded answer.");
    expect(request.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent",
    );
    expect(headers.get("x-goog-api-key")).toBe("test-key");
    expect(headers.get("content-type")).toBe("application/json");
    expect(request.url).not.toContain("test-key");
    expect(request.body.systemInstruction.parts[0].text).toContain(
      "REPORT CONTEXT",
    );
    expect(request.body.systemInstruction.parts[0].text).toContain(
      "AI Test Project",
    );
    expect(request.body.contents).toEqual([
      { role: "user", parts: [{ text: "Earlier question" }] },
      { role: "model", parts: [{ text: "Earlier answer" }] },
      {
        role: "user",
        parts: [{ text: "Which resource is the bottleneck?" }],
      },
    ]);
    expect(request.body.generationConfig).toEqual({
      temperature: 0.2,
      maxOutputTokens: 4_096,
      thinkingConfig: {
        thinkingLevel: "LOW",
      },
    });
  });

  it("merges consecutive user turns after a failed previous request", async () => {
    const input = await createTestAiInput({
      question: "And the queue?",
      history: [
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Unanswered follow-up" },
      ],
    });
    const mock = createCapturingFetch({
      candidates: [{ content: { parts: [{ text: "Queue answer" }] } }],
    });

    await createProvider(mock.fetchImpl).generateReply(input);

    expect(mock.request().body.contents).toEqual([
      { role: "user", parts: [{ text: "First question" }] },
      { role: "model", parts: [{ text: "First answer" }] },
      {
        role: "user",
        parts: [{ text: "Unanswered follow-up\n\nAnd the queue?" }],
      },
    ]);
  });

  it.each([
    [400, 502, "AI_PROVIDER_REQUEST_REJECTED"],
    [401, 502, "AI_PROVIDER_AUTH_FAILED"],
    [403, 502, "AI_PROVIDER_AUTH_FAILED"],
    [404, 502, "AI_PROVIDER_MODEL_NOT_FOUND"],
    [429, 503, "AI_PROVIDER_RATE_LIMITED"],
    [500, 502, "AI_PROVIDER_UNAVAILABLE"],
    [503, 502, "AI_PROVIDER_UNAVAILABLE"],
  ])(
    "maps HTTP %i to a stable API error",
    async (status, expectedStatus, expectedCode) => {
      const input = await createTestAiInput();
      const mock = createCapturingFetch(
        { error: { message: "raw provider detail" } },
        status,
      );

      await expect(
        createProvider(mock.fetchImpl).generateReply(input),
      ).rejects.toMatchObject({
        statusCode: expectedStatus,
        code: expectedCode,
      });
    },
  );

  it("reports a timeout separately from other network failures", async () => {
    const input = await createTestAiInput();
    const timeoutFetch = (async () => {
      const error = new Error("The operation timed out.");
      error.name = "TimeoutError";
      throw error;
    }) as typeof fetch;

    await expect(
      createProvider(timeoutFetch).generateReply(input),
    ).rejects.toMatchObject({
      statusCode: 504,
      code: "AI_PROVIDER_TIMEOUT",
    });
  });

  it("reports a network failure when fetch throws", async () => {
    const input = await createTestAiInput();
    const failingFetch = (async () => {
      throw new Error("connect ECONNREFUSED");
    }) as typeof fetch;

    await expect(
      createProvider(failingFetch).generateReply(input),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "AI_PROVIDER_UNAVAILABLE",
    });
  });

  it("reports safety blocks and empty responses", async () => {
    const input = await createTestAiInput();
    const blocked = createCapturingFetch({
      candidates: [],
      promptFeedback: { blockReason: "SAFETY" },
    });
    const empty = createCapturingFetch({ candidates: [] });

    await expect(
      createProvider(blocked.fetchImpl).generateReply(input),
    ).rejects.toMatchObject({ code: "AI_RESPONSE_BLOCKED" });
    await expect(
      createProvider(empty.fetchImpl).generateReply(input),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_EMPTY_RESPONSE" });
  });

  it("rejects unreadable response bodies", async () => {
    const input = await createTestAiInput();
    const invalidJsonFetch = (async () =>
      new Response("not json", { status: 200 })) as typeof fetch;

    await expect(
      createProvider(invalidJsonFetch).generateReply(input),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "AI_PROVIDER_INVALID_RESPONSE",
    });
  });

  it("refuses to construct a provider without an API key", () => {
    try {
      createGeminiAiProvider({ apiKey: "   " });
      expect.unreachable("Expected provider construction to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        statusCode: 500,
        code: "AI_PROVIDER_NOT_CONFIGURED",
      });
    }
  });
});

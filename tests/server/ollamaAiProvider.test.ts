import { describe, expect, it } from "vitest";
import {
  createOllamaAiProvider,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  type OllamaAiProviderOptions,
} from "../../src/server/ai/ollamaAiProvider.js";
import { createTestAiInput } from "../helpers/createAiInput.js";

interface OllamaRequestBody {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature: number;
  max_tokens: number;
  stream: boolean;
}

interface CapturedRequest {
  url: string;
  init: RequestInit;
  body: OllamaRequestBody;
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
      body: JSON.parse(String(init?.body)) as OllamaRequestBody,
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
  overrides: Partial<OllamaAiProviderOptions> = {},
) {
  return createOllamaAiProvider({
    model: "test-model",
    timeoutMs: 5_000,
    fetchImpl,
    ...overrides,
  });
}

function reply(text: string) {
  return { choices: [{ message: { role: "assistant", content: text } }] };
}

describe("Ollama AI provider", () => {
  it("sends grounded context, history, and the current question to the local server", async () => {
    const input = await createTestAiInput({
      history: [
        { role: "user", content: "Earlier question" },
        { role: "assistant", content: "Earlier answer" },
      ],
    });
    const mock = createCapturingFetch(reply("Local answer."));

    const result = await createProvider(mock.fetchImpl).generateReply(input);
    const request = mock.request();

    expect(result).toBe("Local answer.");
    expect(request.url).toBe(
      `${DEFAULT_OLLAMA_BASE_URL}/chat/completions`,
    );
    expect(request.body.model).toBe("test-model");
    expect(request.body.temperature).toBe(0.2);
    expect(request.body.max_tokens).toBe(2_048);
    expect(request.body.stream).toBe(false);

    const [system, ...conversation] = request.body.messages;
    expect(system.role).toBe("system");
    expect(system.content).toContain("REPORT CONTEXT");
    expect(system.content).toContain("AI Test Project");
    expect(conversation).toEqual([
      { role: "user", content: "Earlier question" },
      { role: "assistant", content: "Earlier answer" },
      {
        role: "user",
        content: "Which resource is the bottleneck?",
      },
    ]);
  });

  it("normalizes a custom base URL with a trailing slash", async () => {
    const input = await createTestAiInput();
    const mock = createCapturingFetch(reply("Answer."));

    await createProvider(mock.fetchImpl, {
      baseUrl: "http://192.168.1.20:11434/v1/",
    }).generateReply(input);

    expect(mock.request().url).toBe(
      "http://192.168.1.20:11434/v1/chat/completions",
    );
  });

  it("uses the documented defaults when no model is configured", async () => {
    const input = await createTestAiInput();
    const mock = createCapturingFetch(reply("Answer."));

    await createOllamaAiProvider({ fetchImpl: mock.fetchImpl }).generateReply(
      input,
    );

    expect(mock.request().body.model).toBe(DEFAULT_OLLAMA_MODEL);
  });

  it("explains how to pull a missing model", async () => {
    const input = await createTestAiInput();
    const mock = createCapturingFetch(
      { error: { message: "model 'test-model' not found" } },
      404,
    );

    await expect(
      createProvider(mock.fetchImpl).generateReply(input),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "AI_PROVIDER_MODEL_NOT_FOUND",
      message: `Ollama model "test-model" was not found. Pull it with: ollama pull test-model`,
    });
  });

  it.each([500, 503])(
    "maps HTTP %i to an unavailable error",
    async (status) => {
      const input = await createTestAiInput();
      const mock = createCapturingFetch({ error: "crashed" }, status);

      await expect(
        createProvider(mock.fetchImpl).generateReply(input),
      ).rejects.toMatchObject({
        statusCode: 502,
        code: "AI_PROVIDER_UNAVAILABLE",
      });
    },
  );

  it("keeps the provider message for other rejected requests", async () => {
    const input = await createTestAiInput();
    const mock = createCapturingFetch(
      { error: { message: "context length exceeded" } },
      400,
    );

    await expect(
      createProvider(mock.fetchImpl).generateReply(input),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "AI_PROVIDER_REQUEST_FAILED",
      message: "Ollama request failed: context length exceeded",
    });
  });

  it("reports a timeout separately from an unreachable server", async () => {
    const input = await createTestAiInput();
    const timeoutFetch = (async () => {
      const error = new Error("The operation timed out.");
      error.name = "TimeoutError";
      throw error;
    }) as typeof fetch;
    const refusedFetch = (async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:11434");
    }) as typeof fetch;

    await expect(
      createProvider(timeoutFetch).generateReply(input),
    ).rejects.toMatchObject({
      statusCode: 504,
      code: "AI_PROVIDER_TIMEOUT",
    });
    await expect(
      createProvider(refusedFetch).generateReply(input),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "AI_PROVIDER_UNAVAILABLE",
    });
  });

  it("rejects empty and unreadable responses", async () => {
    const input = await createTestAiInput();
    const empty = createCapturingFetch(reply("   "));
    const noChoices = createCapturingFetch({ choices: [] });
    const invalidJsonFetch = (async () =>
      new Response("not json", { status: 200 })) as typeof fetch;

    await expect(
      createProvider(empty.fetchImpl).generateReply(input),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_EMPTY_RESPONSE" });
    await expect(
      createProvider(noChoices.fetchImpl).generateReply(input),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_EMPTY_RESPONSE" });
    await expect(
      createProvider(invalidJsonFetch).generateReply(input),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "AI_PROVIDER_INVALID_RESPONSE",
    });
  });
});

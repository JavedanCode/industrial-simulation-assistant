import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import vm from "node:vm";
// Expo uses TS 6's compiler API; the backend's TS 7 package only exposes its CLI.
import ts from "../../mobile/node_modules/typescript";
import app from "../../src/server/app.js";
import { closeDatabase } from "../../src/server/storage/database.js";
import { mockAiProvider } from "../../src/server/ai/mockAiProvider.js";
import { createTestReport } from "../helpers/createTestReport.js";

let server: ReturnType<typeof app.listen>;
let baseUrl: string;
const testDirectory = mkdtempSync(join(tmpdir(), "mobile-api-test-"));
// Exercise the actual mobile transport and decoders over HTTP without a native runtime.
function mobileModules(fetchImpl = fetch, url = baseUrl) {
  const cache: Record<string, any> = {};
  function load(name: string): any {
    if (cache[name]) return cache[name];
    const exports = {};
    const code = ts.transpileModule(
      readFileSync(resolve("mobile/src/api", `${name}.ts`), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText;
    vm.runInNewContext(code, {
      exports,
      require: (id: string) => load(id.replace("./", "")),
      fetch: fetchImpl,
      process: { env: { EXPO_PUBLIC_API_URL: url } },
      URL,
      AbortController,
      setTimeout,
      clearTimeout,
    });
    cache[name] = exports;
    return exports;
  }
  return {
    client: load("client"),
    api: load("reports"),
    contracts: load("contracts"),
  };
}

beforeAll(async () => {
  vi.stubEnv("AI_PROVIDER", "mock");
  vi.stubEnv("DATABASE_PATH", join(testDirectory, "test.db"));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No HTTP address");
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  closeDatabase();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  // This path is created solely by this test, never the application's data directory.
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("mobile API integration", () => {
  it("uploads, renders real metrics, replays requests after restart and restores chat", async () => {
    const { client, api } = mobileModules();
    await client.checkHealth();
    const body = new FormData();
    body.append(
      "report",
      new Blob([new Uint8Array(await createTestReport())]),
      "phone.xlsx",
    );
    const requestId = randomUUID();
    const first = await api.analyzeReport(body, requestId);
    expect(first.analysis.markdown).toContain("Test Project");
    expect(first.analysis.markdown).toContain("Assembler");
    expect(first.analysis.utilization[0].value).toBeCloseTo(0.775, 4);
    const conversationId = await api.createConversation(
      first.reportId,
      requestId,
    );
    const msg = {
      id: randomUUID(),
      role: "user",
      content: "What is the bottleneck?",
      createdAt: new Date().toISOString(),
    };
    const [one, two] = await Promise.all([
      api.sendApiMsg(conversationId, msg, new AbortController().signal),
      api.sendApiMsg(conversationId, msg, new AbortController().signal),
    ]);
    expect(one.assistant.id).toBe(two.assistant.id);
    closeDatabase(); // Reopening SQLite simulates loss of process-local caches.
    expect((await api.analyzeReport(body, requestId)).reportId).toBe(
      first.reportId,
    );
    expect(await api.createConversation(first.reportId, requestId)).toBe(
      conversationId,
    );
    expect(
      (await api.sendApiMsg(conversationId, msg, new AbortController().signal))
        .assistant.id,
    ).toBe(one.assistant.id);
    expect((await api.loadHistory(conversationId)).length).toBe(2);
  });

  it("retries provider failures without duplicate questions and rejects changed request content", async () => {
    const { api } = mobileModules();
    const body = new FormData();
    body.append(
      "report",
      new Blob([new Uint8Array(await createTestReport())]),
      "retry.xlsm",
    );
    const requestId = randomUUID();
    const report = await api.analyzeReport(body, requestId);
    const conversationId = await api.createConversation(
      report.reportId,
      requestId,
    );
    const msg = {
      id: randomUUID(),
      role: "user",
      content: "Explain the queue",
      createdAt: new Date().toISOString(),
    };
    const provider = vi
      .spyOn(mockAiProvider, "generateReply")
      .mockRejectedValueOnce(Error("provider down"))
      .mockResolvedValueOnce("Recovered reply");
    try {
      await expect(
        api.sendApiMsg(conversationId, msg, new AbortController().signal),
      ).rejects.toMatchObject({ status: 502 });
      expect((await api.loadHistory(conversationId)).length).toBe(1);
      await api.sendApiMsg(conversationId, msg, new AbortController().signal);
      await api.sendApiMsg(conversationId, msg, new AbortController().signal);
      expect((await api.loadHistory(conversationId)).length).toBe(2);
      expect(provider).toHaveBeenCalledTimes(2);
      await expect(
        api.sendApiMsg(
          conversationId,
          { ...msg, content: "Different" },
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ status: 409 });
      const other = new FormData();
      other.append(
        "report",
        new Blob([
          new Uint8Array(await createTestReport({ projectName: "Different" })),
        ]),
        "retry.xlsm",
      );
      await expect(api.analyzeReport(other, requestId)).rejects.toMatchObject({
        status: 409,
      });
    } finally {
      provider.mockRestore();
    }
  });

  it("surfaces invalid files, missing configuration, timeout and bad response shapes", async () => {
    const { api, contracts } = mobileModules();
    const body = new FormData();
    body.append("report", new Blob(["invalid"]), "broken.xlsx");
    await expect(api.analyzeReport(body, randomUUID())).rejects.toMatchObject({
      status: 422,
    });
    const old = new FormData();
    old.append("report", new Blob(["old"]), "old.xls");
    await expect(api.analyzeReport(old, randomUUID())).rejects.toMatchObject({
      status: 400,
    });
    expect(() =>
      contracts.analysisPresentation({
        report: {},
        semantics: {},
        insights: { schemaVersion: 99 },
      }),
    ).toThrow();
    expect(() => mobileModules(fetch, "").client.getApiUrl()).toThrow(
      /EXPO_PUBLIC_API_URL/,
    );
    const hangingFetch = ((_url: unknown, options: RequestInit) =>
      new Promise((_resolve, reject) =>
        options.signal!.addEventListener("abort", () =>
          reject(Error("aborted")),
        ),
      )) as typeof fetch;
    await expect(
      mobileModules(hangingFetch).client.apiRequest("/health", {
        timeoutMs: 10,
      }),
    ).rejects.toThrow(/too long/);
  });
});

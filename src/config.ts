import { resolve } from "node:path";
import { z } from "zod";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_TIMEOUT_MS,
} from "./server/ai/geminiAiProvider.js";
import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_TIMEOUT_MS,
} from "./server/ai/ollamaAiProvider.js";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATA_DIR: z.string().trim().min(1).default("data"),
  DATABASE_PATH: z.string().trim().min(1).optional(),
  AI_PROVIDER: z.enum(["mock", "gemini", "ollama"]).default("mock"),
  GEMINI_API_KEY: z.string().trim().min(1).optional(),
  GEMINI_MODEL: z.string().trim().min(1).default(DEFAULT_GEMINI_MODEL),
  GEMINI_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(120_000)
    .default(DEFAULT_GEMINI_TIMEOUT_MS),
  OLLAMA_BASE_URL: z.string().trim().min(1).default(DEFAULT_OLLAMA_BASE_URL),
  OLLAMA_MODEL: z.string().trim().min(1).default(DEFAULT_OLLAMA_MODEL),
  OLLAMA_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(300_000)
    .default(DEFAULT_OLLAMA_TIMEOUT_MS),
  CORS_ORIGIN: z.string().trim().min(1).default("*"),
});

export type AiProviderName = z.infer<typeof envSchema>["AI_PROVIDER"];

export interface AppConfig {
  port: number;
  dataDir: string;
  databasePath: string;
  aiProvider: AiProviderName;
  geminiApiKey: string | null;
  geminiModel: string;
  geminiTimeoutMs: number;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaTimeoutMs: number;
  corsOrigin: string;
}

function readEnvironment(): Record<string, string | undefined> {
  return {
    PORT: process.env.PORT,
    DATA_DIR: process.env.DATA_DIR || undefined,
    DATABASE_PATH: process.env.DATABASE_PATH || undefined,
    AI_PROVIDER: process.env.AI_PROVIDER || undefined,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
    GEMINI_MODEL: process.env.GEMINI_MODEL || undefined,
    GEMINI_TIMEOUT_MS: process.env.GEMINI_TIMEOUT_MS || undefined,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || undefined,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || undefined,
    OLLAMA_TIMEOUT_MS: process.env.OLLAMA_TIMEOUT_MS || undefined,
    CORS_ORIGIN: process.env.CORS_ORIGIN || undefined,
  };
}

export function getConfig(): AppConfig {
  const parsed = envSchema.safeParse(readEnvironment());

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const environment = parsed.data;
  const dataDir = resolve(environment.DATA_DIR);
  const databasePath =
    environment.DATABASE_PATH === ":memory:"
      ? ":memory:"
      : environment.DATABASE_PATH
        ? resolve(environment.DATABASE_PATH)
        : resolve(dataDir, "assistant.db");

  return {
    port: environment.PORT,
    dataDir,
    databasePath,
    aiProvider: environment.AI_PROVIDER,
    geminiApiKey: environment.GEMINI_API_KEY ?? null,
    geminiModel: environment.GEMINI_MODEL,
    geminiTimeoutMs: environment.GEMINI_TIMEOUT_MS,
    ollamaBaseUrl: environment.OLLAMA_BASE_URL,
    ollamaModel: environment.OLLAMA_MODEL,
    ollamaTimeoutMs: environment.OLLAMA_TIMEOUT_MS,
    corsOrigin: environment.CORS_ORIGIN,
  };
}

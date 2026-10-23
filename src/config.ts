import { resolve } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATA_DIR: z.string().trim().min(1).default("data"),
  DATABASE_PATH: z.string().trim().min(1).optional(),
  AI_PROVIDER: z.enum(["mock"]).default("mock"),
  CORS_ORIGIN: z.string().trim().min(1).default("*"),
});

export type AiProviderName = z.infer<typeof envSchema>["AI_PROVIDER"];

export interface AppConfig {
  port: number;
  dataDir: string;
  databasePath: string;
  aiProvider: AiProviderName;
  corsOrigin: string;
}

function readEnvironment(): Record<string, string | undefined> {
  return {
    PORT: process.env.PORT,
    DATA_DIR: process.env.DATA_DIR || undefined,
    DATABASE_PATH: process.env.DATABASE_PATH || undefined,
    AI_PROVIDER: process.env.AI_PROVIDER || undefined,
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
    corsOrigin: environment.CORS_ORIGIN,
  };
}

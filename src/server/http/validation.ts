import { z } from "zod";
import { AppError } from "./appError.js";
import type { ValidationIssue } from "./appError.js";

const uuidSchema = z.uuid();

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    const details: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    throw new AppError(400, "Invalid request body.", "VALIDATION_ERROR", details);
  }

  return result.data;
}

export function parseUuidParam(value: unknown, name: string): string {
  const result = uuidSchema.safeParse(value);

  if (!result.success) {
    throw new AppError(400, `${name} must be a valid UUID.`, "INVALID_ID");
  }

  return result.data;
}

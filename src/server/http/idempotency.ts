import { z } from "zod";
import { AppError } from "./appError.js";
import { getDatabase } from "../storage/database.js";

export function requestKey(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!z.uuid().safeParse(value).success)
    throw new AppError(400, "Idempotency-Key must be a UUID.");
  return value;
}

export function readReceipt(
  scope: string,
  key: string | undefined,
  fingerprint: string,
): unknown | undefined {
  if (!key) return undefined;
  const row = getDatabase()
    .prepare(
      "SELECT fingerprint, response FROM api_receipts WHERE scope = ? AND key = ?",
    )
    .get(scope, key) as { fingerprint: string; response: string } | undefined;
  if (!row) return undefined;
  if (row.fingerprint !== fingerprint)
    throw new AppError(
      409,
      "This request ID was already used for different content.",
    );
  return JSON.parse(row.response);
}

// Call inside the same transaction as creating the resource: both survive or neither does.
export function saveReceipt(
  scope: string,
  key: string | undefined,
  fingerprint: string,
  reportId: string,
  response: unknown,
) {
  if (key)
    getDatabase()
      .prepare(
        "INSERT INTO api_receipts (scope, key, fingerprint, report_id, response) VALUES (?, ?, ?, ?, ?)",
      )
      .run(scope, key, fingerprint, reportId, JSON.stringify(response));
}

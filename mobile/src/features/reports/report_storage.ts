import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { Directory, File, Paths } from "expo-file-system";
import { buildReport, type ReportSubmissionInput } from "./report_submission";
import type { SavedReport } from "./report_types";
import { validateReportTitle } from "./report_management";

let dbPromise: Promise<SQLiteDatabase> | undefined;
function initReportsDb() {
  if (!dbPromise)
    dbPromise = (async () => {
      const db = await openDatabaseAsync("reports.db");
      try {
        await db.execAsync(`PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, createdAt TEXT NOT NULL,
          source TEXT NOT NULL CHECK(source IN ('text','document')),
          status TEXT NOT NULL, content TEXT, documentName TEXT, documentPath TEXT,
          mimeType TEXT, size INTEGER
        );`);
        return db;
      } catch (error) {
        await db.closeAsync();
        throw error;
      }
    })().catch((error) => {
      dbPromise = undefined;
      throw error;
    });
  return dbPromise;
}

export async function loadReports(): Promise<SavedReport[]> {
  const db = await initReportsDb();
  return db.getAllAsync<SavedReport>(
    "SELECT * FROM reports ORDER BY createdAt DESC, id DESC",
  );
}

export async function renameReport(id: string, value: string): Promise<string> {
  const title = validateReportTitle(value);
  const db = await initReportsDb();
  // Parameters keep quotes in a user's title separate from SQL commands.
  const result = await db.runAsync(
    "UPDATE reports SET title = ? WHERE id = ?",
    title,
    id,
  );
  if (!result.changes) throw new Error("Report not found.");
  return title;
}

export async function deleteReport(id: string): Promise<void> {
  const db = await initReportsDb();
  const report = await db.getFirstAsync<SavedReport>(
    "SELECT * FROM reports WHERE id = ?",
    id,
  );
  if (!report) return; // Repeating a completed deletion is safe.
  if (report.documentPath) {
    // Only remove the app-owned copy for this ID, never the original picked file.
    const fileName = report.documentPath.slice("reports/".length);
    if (
      !report.documentPath.startsWith("reports/") ||
      !/^[a-f0-9-]{36}\.[a-z0-9]+$/i.test(fileName) ||
      !fileName.startsWith(`${id}.`)
    ) {
      throw new Error("The saved document path is invalid.");
    }
    const file = new File(Paths.document, report.documentPath);
    if (file.exists) file.delete();
  }
  // Keep the row until file cleanup succeeds. A failed final delete can be retried
  // even if the file is already gone; files and SQLite cannot share a transaction.
  await db.runAsync("DELETE FROM reports WHERE id = ?", id);
}

export async function saveReport(
  id: string,
  input: ReportSubmissionInput,
): Promise<SavedReport> {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Invalid report ID.");
  const report = buildReport(id, input);
  const db = await initReportsDb();
  let copiedFile: File | undefined;
  try {
    const directory = new Directory(Paths.document, "reports");
    directory.create({ idempotent: true, intermediates: true });
    const extension = input.document.name
      .slice(input.document.name.lastIndexOf("."))
      .toLowerCase();
    const relativePath = `reports/${id}${extension}`;
    const destination = new File(Paths.document, relativePath);
    if (destination.exists)
      throw new Error("A document already exists for this report.");
    copiedFile = destination;
    await new File(input.document.uri).copy(destination);
    if (!destination.exists)
      throw new Error("Could not copy the selected document.");
    report.documentPath = relativePath;
    report.size = destination.size;
    await db.runAsync(
      `INSERT INTO reports
      (id,title,createdAt,source,status,content,documentName,documentPath,mimeType,size)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      report.id,
      report.title,
      report.createdAt,
      report.source,
      report.status,
      report.content,
      report.documentName,
      report.documentPath,
      report.mimeType,
      report.size,
    );
    return report;
  } catch (error) {
    if (copiedFile?.exists) {
      try {
        copiedFile.delete();
      } catch {
        throw new Error(
          "Report was not saved. Could not remove its incomplete document copy. Your draft is still available; please try again.",
        );
      }
    }
    throw error;
  }
}

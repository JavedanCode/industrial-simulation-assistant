import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { Directory, File, Paths } from "expo-file-system";
import { buildReport, type ReportSubmissionInput } from "./report_submission";
import type { SavedReport } from "./report_types";

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

export async function saveReport(
  id: string,
  input: ReportSubmissionInput,
): Promise<SavedReport> {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Invalid report ID.");
  const report = buildReport(id, input);
  const db = await initReportsDb();
  let copiedFile: File | undefined;
  try {
    if (input.source === "document") {
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
    }
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

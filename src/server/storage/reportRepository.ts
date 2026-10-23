import { randomUUID } from "node:crypto";
import { getDatabase } from "./database.js";
import type { ReportSummary, StoredReport } from "./types.js";
import type { ReportAnalysisResult } from "../services/reportAnalysisService.js";

interface ReportRow {
  id: string;
  file_name: string;
  created_at: string;
  project_name: string | null;
  model_run_date: string | null;
  declared_replication_count: number | null;
  analysis_json: string;
}

function mapStoredReport(row: ReportRow): StoredReport {
  return {
    reportId: row.id,
    fileName: row.file_name,
    createdAt: row.created_at,
    analysis: JSON.parse(row.analysis_json) as ReportAnalysisResult,
  };
}

export function insertReport(
  fileName: string,
  analysis: ReportAnalysisResult,
): StoredReport {
  const reportId = randomUUID();
  const createdAt = new Date().toISOString();

  getDatabase()
    .prepare(
      `
        INSERT INTO reports (
          id,
          file_name,
          created_at,
          project_name,
          model_run_date,
          declared_replication_count,
          analysis_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      reportId,
      fileName,
      createdAt,
      analysis.semantics.projectName,
      analysis.semantics.modelRunDate,
      analysis.semantics.declaredReplicationCount,
      JSON.stringify(analysis),
    );

  return {
    reportId,
    fileName,
    createdAt,
    analysis,
  };
}

export function findReportById(reportId: string): StoredReport | null {
  const row = getDatabase()
    .prepare("SELECT * FROM reports WHERE id = ?")
    .get(reportId) as unknown as ReportRow | undefined;

  return row ? mapStoredReport(row) : null;
}

export function listReportSummaries(): ReportSummary[] {
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          id,
          file_name,
          created_at,
          project_name,
          model_run_date,
          declared_replication_count,
          analysis_json
        FROM reports
        ORDER BY created_at DESC, rowid DESC
      `,
    )
    .all() as unknown as ReportRow[];

  return rows.map((row) => ({
    reportId: row.id,
    fileName: row.file_name,
    createdAt: row.created_at,
    projectName: row.project_name,
    modelRunDate: row.model_run_date,
    declaredReplicationCount: row.declared_replication_count,
  }));
}

export function deleteReportById(reportId: string): boolean {
  const result = getDatabase()
    .prepare("DELETE FROM reports WHERE id = ?")
    .run(reportId);

  return Number(result.changes) > 0;
}

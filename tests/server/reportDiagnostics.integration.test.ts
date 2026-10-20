import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractWorkbook } from "../../src/server/services/reportParserService.js";
import { normalizeReport } from "../../src/server/services/reportNormalizerService.js";

// Change this filename to inspect another Arena Excel report.
// The file must be located inside local-reports/.
const reportFileName = "arena-example-2.xlsm";
const reportPath = join("local-reports", reportFileName);

// Each input report gets its own diagnostics file, so comparisons do not
// accidentally overwrite the previous report's output.
const diagnosticsPath = join(
  "local-reports",
  `${basename(reportFileName, extname(reportFileName))}-diagnostics.txt`,
);

describe("Arena report diagnostics", () => {
  it.skipIf(!existsSync(reportPath))(
    `extracts and normalizes ${reportFileName}`,
    async () => {
      const buffer = readFileSync(reportPath);
      const rawWorkbook = await extractWorkbook(buffer, reportFileName);
      const report = normalizeReport(rawWorkbook);

      const summarySections = report.summary.sections;

      const tableDiagnostics = Object.fromEntries(
        Object.entries(report.tables).map(([name, table]) => [
          name,
          {
            columns: table.columns,
            rowCount: table.rows.length,
            sampleRows: table.rows.slice(0, 3),
          },
        ]),
      );

      const summarySectionDiagnostics = Object.fromEntries(
        Object.entries(summarySections).map(([name, section]) => [
          name,
          {
            sourceWorksheet: section.sourceWorksheet,
            range: `${section.startColumn}:${section.endColumn}`,
            columns: section.columns,
            columnCount: section.columns.length,
            rowCount: section.rows.length,
            sampleRows: section.rows.slice(0, 3),
            lastRows: section.rows.slice(-2),
          },
        ]),
      );

      // Generic sanity checks only. Do not hardcode one report's worksheet
      // list, metadata, or row counts here: this test is for comparing reports.
      expect(report.sourceFormat).toBeDefined();
      expect(rawWorkbook.worksheets.length).toBeGreaterThan(0);
      expect(report.tables).toBeDefined();
      expect(report.summary.sections).toBeDefined();
      expect(report.warnings).toBeDefined();

      const diagnostics = [
        "========== ARENA REPORT DIAGNOSTICS ==========",
        "",
        "--- Execution ---",
        `Input file: ${reportFileName}`,
        `Source format: ${report.sourceFormat}`,
        `Generated at: ${new Date().toISOString()}`,
        `Diagnostic output: ${diagnosticsPath}`,
        "",
        "--- Worksheets ---",
        JSON.stringify(
          rawWorkbook.worksheets.map((sheet) => ({
            name: sheet.name,
            rowCount: sheet.rowCount,
            columnCount: sheet.columnCount,
            extractedRows: sheet.rows.length,
            firstRows: sheet.rows.slice(0, 5),
          })),
          null,
          2,
        ),
        "",
        "--- Metadata ---",
        JSON.stringify(report.metadata, null, 2),
        "",
        "--- Statistics table schemas and sample rows ---",
        JSON.stringify(tableDiagnostics, null, 2),
        "",
        "--- Summary section schemas and sample rows ---",
        JSON.stringify(summarySectionDiagnostics, null, 2),
        "",
        "--- Complete normalized statistics data ---",
        JSON.stringify(
          Object.fromEntries(
            Object.entries(report.tables).map(([name, table]) => [
              name,
              table.rows,
            ]),
          ),
          null,
          2,
        ),
        "",
        "--- Complete normalized summary data ---",
        JSON.stringify(summarySections, null, 2),
        "",
        "--- Raw extraction warnings ---",
        JSON.stringify(rawWorkbook.warnings ?? [], null, 2),
        "",
        "--- Normalized report warnings ---",
        JSON.stringify(report.warnings, null, 2),
        "",
        "========== END DIAGNOSTICS ==========",
        "",
      ].join("\n");

      writeFileSync(diagnosticsPath, diagnostics, "utf8");

      expect(existsSync(diagnosticsPath)).toBe(true);

      console.log(`Arena diagnostics written to: ${diagnosticsPath}`);
      console.log(
        `Diagnostic file size: ${Buffer.byteLength(diagnostics, "utf8")} bytes`,
      );
      console.log(
        `Worksheets: ${rawWorkbook.worksheets.map((sheet) => sheet.name).join(", ")}`,
      );
      console.log(
        `Statistics row counts: ${Object.entries(report.tables)
          .map(([name, table]) => `${name}=${table.rows.length}`)
          .join(", ")}`,
      );
      console.log(
        `Summary section row counts: ${Object.entries(summarySections)
          .map(([name, section]) => `${name}=${section.rows.length}`)
          .join(", ")}`,
      );
    },
  );
});

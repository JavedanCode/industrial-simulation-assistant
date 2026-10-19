import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractWorkbook } from "../../src/server/services/reportParserService.js";
import { normalizeReport } from "../../src/server/services/reportNormalizerService.js";

const reportPath = "local-reports/arena-example-1-recalculated.xlsm";
const reportFileName = "arena-example-1.xlsm";
const diagnosticsPath = "local-reports/arena-integration-diagnostics.txt";

describe("Arena example report integration", () => {
  it.skipIf(!existsSync(reportPath))(
    "extracts and normalizes the actual Arena report",
    async () => {
      const buffer = readFileSync(reportPath);
      const rawWorkbook = await extractWorkbook(buffer, reportFileName);
      const report = normalizeReport(rawWorkbook);

      const summarySections = report.summary.sections;

      const tableRowCounts = Object.fromEntries(
        Object.entries(report.tables).map(([name, table]) => [
          name,
          table.rows.length,
        ]),
      );

      const summarySectionStats = Object.fromEntries(
        Object.entries(summarySections).map(([name, section]) => [
          name,
          {
            range: `${section.startColumn}:${section.endColumn}`,
            columnCount: section.columns.length,
            rowCount: section.rows.length,
          },
        ]),
      );

      // Workbook and metadata assertions
      expect(report.sourceFormat).toBe("xlsm");

      expect(rawWorkbook.worksheets.map((sheet) => sheet.name)).toEqual([
        "ProjectInformation",
        "AcrossReplicationsSummary",
        "DiscreteTimeStatsByRep",
        "ContinuousTimeStatsByRep",
        "CounterStatsByRep",
        "OutputStatsByRep",
        "FrequencyStatsByRep",
      ]);

      expect(report.metadata.projectName).toBe("Unnamed Project");
      expect(report.metadata.modelFile).toBe("E:\\finaal\\finaal.p");
      expect(report.metadata.numberOfReplications).toBe(15);
      expect(report.metadata.averageStatCollectionLength).toBe(8000);
      expect(report.metadata.confidenceInterval).toBe(0.95);

      // Statistics table assertions
      expect(tableRowCounts).toEqual({
        discreteTimeStats: 0,
        continuousTimeStats: 690,
        counterStats: 75,
        outputStats: 405,
        frequencyStats: 0,
      });

      expect(report.tables.continuousTimeStats.columns).toContain("Average");
      expect(report.tables.continuousTimeStats.rows.length).toBeGreaterThan(0);

      expect(report.tables.frequencyStats.columns).toContain("Category");
      expect(report.tables.frequencyStats.columns).toContain(
        "StandardPercentage",
      );
      expect(report.tables.frequencyStats.rows).toHaveLength(0);

      // Summary section assertions
      expect(summarySections.replicationAveragesWithObservations).toMatchObject(
        {
          sourceWorksheet: "AcrossReplicationsSummary",
          startColumn: "A",
          endColumn: "M",
        },
      );

      expect(summarySections.replicationAverages).toMatchObject({
        sourceWorksheet: "AcrossReplicationsSummary",
        startColumn: "O",
        endColumn: "Y",
      });

      expect(summarySections.continuousAcrossReplications).toMatchObject({
        sourceWorksheet: "AcrossReplicationsSummary",
        startColumn: "AA",
        endColumn: "AI",
      });

      expect(summarySections.discreteAcrossReplications).toMatchObject({
        sourceWorksheet: "AcrossReplicationsSummary",
        startColumn: "AK",
        endColumn: "AS",
      });

      expect(summarySections.frequencySummary).toMatchObject({
        sourceWorksheet: "AcrossReplicationsSummary",
        startColumn: "AU",
        endColumn: "AZ",
      });

      expect(
        summarySections.replicationAveragesWithObservations.rows,
      ).toHaveLength(0);

      expect(summarySections.replicationAverages.rows).toHaveLength(46);
      expect(summarySections.continuousAcrossReplications.rows).toHaveLength(5);
      expect(summarySections.discreteAcrossReplications.rows).toHaveLength(27);
      expect(summarySections.frequencySummary.rows).toHaveLength(0);

      // Build a detailed diagnostic report.
      const diagnostics = [
        "========== ARENA REPORT INTEGRATION DIAGNOSTICS ==========",
        "",
        "--- Execution ---",
        `Input file: ${reportFileName}`,
        `Source format: ${report.sourceFormat}`,
        `Generated at: ${new Date().toISOString()}`,
        "",
        "--- Worksheets ---",
        JSON.stringify(
          rawWorkbook.worksheets.map((sheet) => ({
            name: sheet.name,
            rowCount: sheet.rowCount,
            columnCount: sheet.columnCount,
            extractedRows: sheet.rows.length,
          })),
          null,
          2,
        ),
        "",
        "--- Metadata ---",
        JSON.stringify(report.metadata, null, 2),
        "",
        "--- Statistics table schemas and row counts ---",
        JSON.stringify(
          Object.fromEntries(
            Object.entries(report.tables).map(([name, table]) => [
              name,
              {
                columns: table.columns,
                rowCount: table.rows.length,
                sampleRows: table.rows.slice(0, 3),
              },
            ]),
          ),
          null,
          2,
        ),
        "",
        "--- Summary section schemas and data ---",
        JSON.stringify(
          Object.fromEntries(
            Object.entries(summarySections).map(([name, section]) => [
              name,
              {
                ...summarySectionStats[
                  name as keyof typeof summarySectionStats
                ],
                sourceWorksheet: section.sourceWorksheet,
                columns: section.columns,
                rowCount: section.rows.length,
                sampleRows: section.rows.slice(0, 3),
                lastRows: section.rows.slice(-2),
              },
            ]),
          ),
          null,
          2,
        ),
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
        "--- Raw worksheet cell samples ---",
        JSON.stringify(
          rawWorkbook.worksheets.map((sheet) => ({
            name: sheet.name,
            firstRows: sheet.rows.slice(0, 5),
          })),
          null,
          2,
        ),
        "",
        "========== END DIAGNOSTICS ==========",
        "",
      ].join("\n");

      writeFileSync(diagnosticsPath, diagnostics, "utf8");

      // Verify that the diagnostic file was written successfully.
      expect(existsSync(diagnosticsPath)).toBe(true);

      console.log(`Arena diagnostics written to: ${diagnosticsPath}`);
      console.log(
        `Diagnostic file size: ${Buffer.byteLength(diagnostics, "utf8")} bytes`,
      );
    },
  );
});

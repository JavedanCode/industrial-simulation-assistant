import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractWorkbook } from "../../src/server/services/reportParserService.js";
import { normalizeReport } from "../../src/server/services/reportNormalizerService.js";

const reportPath = "local-reports/arena-example-1.xlsm";
const reportFileName = "arena-example-1.xlsm";

describe("Arena example report integration", () => {
  it.skipIf(!existsSync(reportPath))(
    "extracts and normalizes the actual Arena report",
    async () => {
      const buffer = readFileSync(reportPath);

      const rawWorkbook = await extractWorkbook(buffer, reportFileName);

      const summarySheet = rawWorkbook.worksheets.find(
        (sheet) => sheet.name === "AcrossReplicationsSummary",
      );

      console.log(
        "AcrossReplicationsSummary headers A:M:",
        summarySheet?.rows
          .find((row) => row.excelRow === 2)
          ?.cells.filter((cell) => /^[A-M]2$/.test(cell.address))
          .map((cell) => ({
            address: cell.address,
            value: cell.value,
          })),
      );

      console.log(
        "Summary section headers:",
        JSON.stringify(
          [
            ["A", "M"],
            ["O", "Y"],
            ["AA", "Y"],
            ["AK", "AS"],
            ["AU", "AZ"],
          ].map(([start, end]) => ({
            range: `${start}2:${end}2`,
            headers: summarySheet?.rows
              .find((row) => row.excelRow === 2)
              ?.cells.filter((cell) => {
                const column = cell.address.replace(/[0-9]/g, "");
                return column >= start! && column <= end!;
              })
              .map((cell) => ({
                address: cell.address,
                value: cell.value,
              })),
          })),
          null,
          2,
        ),
      );

      const frequencySheet = rawWorkbook.worksheets.find(
        (sheet) => sheet.name === "FrequencyStatsByRep",
      );

      console.log(
        "Frequency worksheet raw headers:",
        frequencySheet?.rows[0]?.cells.map((cell) => cell.value),
      );
      const report = normalizeReport(rawWorkbook);

      const tableRowCounts = Object.fromEntries(
        Object.entries(report.tables).map(([name, table]) => [
          name,
          table.rows.length,
        ]),
      );

      console.log(
        JSON.stringify(
          {
            sourceFormat: report.sourceFormat,
            worksheetNames: rawWorkbook.worksheets.map(
              (worksheet) => worksheet.name,
            ),
            metadata: report.metadata,
            tableRowCounts,
            tableColumns: Object.fromEntries(
              Object.entries(report.tables).map(([name, table]) => [
                name,
                table.columns,
              ]),
            ),
            continuousTimeSample: report.tables.continuousTimeStats.rows.slice(
              0,
              3,
            ),
          },
          null,
          2,
        ),
      );

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

      expect(report.metadata.projectName).not.toBeNull();
      expect(report.metadata.numberOfReplications).toBe(15);
      expect(report.metadata.projectName).toBe("Unnamed Project");
      expect(report.metadata.modelFile).toBe("E:\\finaal\\finaal.p");
      expect(report.metadata.numberOfReplications).toBe(15);
      expect(report.metadata.averageStatCollectionLength).toBe(8000);
      expect(report.metadata.confidenceInterval).toBe(0.95);

      expect(report.tables.frequencyStats.columns).toContain("Category");
      expect(report.tables.frequencyStats.columns).toContain(
        "StandardPercentage",
      );
      expect(report.tables.frequencyStats.rows).toHaveLength(0);

      expect(tableRowCounts).toEqual({
        discreteTimeStats: 0,
        continuousTimeStats: 690,
        counterStats: 75,
        outputStats: 405,
        frequencyStats: 0,
      });

      expect(report.tables.continuousTimeStats.columns).toContain("Average");

      expect(report.tables.continuousTimeStats.rows.length).toBeGreaterThan(0);
    },
  );
});

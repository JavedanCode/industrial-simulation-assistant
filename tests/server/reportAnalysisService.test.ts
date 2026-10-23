import { describe, expect, it } from "vitest";
import type { NormalizedReport } from "../../src/models/NormalizedReport.js";
import { analyzeNormalizedReport } from "../../src/server/services/reportAnalysisService.js";

function createReport(): NormalizedReport {
  const emptyTable = {
    sourceWorksheet: "",
    columns: [],
    rows: [],
  };

  const emptySummarySection = {
    sourceWorksheet: "AcrossReplicationsSummary" as const,
    startColumn: "A",
    endColumn: "M",
    columns: [],
    rows: [],
  };

  return {
    schemaVersion: 1,
    sourceFormat: "xlsm",
    metadata: {
      projectName: "Test Project",
      modelFile: null,
      modelRunDate: "2026-10-20",
      timeUnits: 3,
      timeUnitLabel: "Hours",
      numberOfReplications: 2,
      averageStatCollectionLength: 8000,
      confidenceInterval: 0.95,
    },
    tables: {
      discreteTimeStats: emptyTable,
      continuousTimeStats: {
        sourceWorksheet: "ContinuousTimeStatsByRep",
        columns: ["Name", "Type", "Source", "Replication", "Average"],
        rows: [
          {
            Name: "assembler",
            Type: "Number Busy",
            Source: "Resource",
            Replication: 1,
            Average: 1,
          },
          {
            Name: "assembler",
            Type: "Number Busy",
            Source: "Resource",
            Replication: 2,
            Average: 2,
          },
        ],
      },
      counterStats: emptyTable,
      outputStats: emptyTable,
      frequencyStats: emptyTable,
    },
    summary: {
      schemaVersion: 1,
      sections: {
        replicationAveragesWithObservations: emptySummarySection,
        replicationAverages: emptySummarySection,
        continuousAcrossReplications: emptySummarySection,
        discreteAcrossReplications: emptySummarySection,
        frequencySummary: emptySummarySection,
      },
    },
    warnings: [],
  };
}

describe("analyzeNormalizedReport", () => {
  it("returns the original report and its semantic summary", () => {
    const report = createReport();

    const result = analyzeNormalizedReport(report);

    expect(result.report).toBe(report);
    expect(result.semantics.projectName).toBe("Test Project");
    expect(result.semantics.declaredReplicationCount).toBe(2);
    expect(result.semantics.totalContinuousRows).toBe(2);
    expect(result.semantics.groupedContinuousRows).toBe(2);
    expect(result.semantics.continuousStatistics).toHaveLength(1);
    expect(result.insights.resources).toHaveLength(1);
    expect(result.insights.resources[0].name).toBe("assembler");
    expect(
      result.insights.resources[0].numberBusy?.average,
    ).toBeCloseTo(1.5, 4);
    expect(result.insights.bottleneck.resource).toBeNull();
  });
});

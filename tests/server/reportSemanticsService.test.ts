import { describe, expect, it } from "vitest";
import { interpretHalfWidth } from "../../src/server/services/reportSemanticsService";
import { interpretStatisticRow } from "../../src/server/services/reportSemanticsService.js";
import { interpretContinuousTimeRow } from "../../src/server/services/reportSemanticsService.js";
import { groupContinuousTimeStats } from "../../src/server/services/reportSemanticsService.js";
import { buildReportSemanticSummary } from "../../src/server/services/reportSemanticsService.js";

describe("interpretHalfWidth", () => {
  it("preserves a valid numerical half-width", () => {
    expect(interpretHalfWidth(12.5)).toEqual({
      status: "available",
      value: 12.5,
    });
  });

  it("identifies insufficient values", () => {
    expect(interpretHalfWidth("Insufficient")).toEqual({
      status: "unavailable",
      reason: "insufficient-data",
      rawValue: "Insufficient",
    });
  });

  it("identifies correlated values", () => {
    expect(interpretHalfWidth("Correlated")).toEqual({
      status: "unavailable",
      reason: "correlated",
      rawValue: "Correlated",
    });
  });

  it("does not interpret null as zero", () => {
    expect(interpretHalfWidth(null)).toEqual({
      status: "unavailable",
      reason: "unknown",
      rawValue: null,
    });
  });

  it("handles unexpected text safely", () => {
    expect(interpretHalfWidth("not-a-number")).toEqual({
      status: "unavailable",
      reason: "unknown",
      rawValue: "not-a-number",
    });
  });
});

describe("interpretStatisticRow", () => {
  it("recognizes resource utilization", () => {
    expect(
      interpretStatisticRow({
        Name: "assembler",
        Type: "Instantaneous Utilization",
        Source: "Resource",
      }),
    ).toMatchObject({
      category: "utilization",
      recognized: true,
    });
  });

  it("recognizes system throughput", () => {
    expect(
      interpretStatisticRow({
        Name: "System.NumberOut",
        Type: "Number Out",
        Source: "System",
      }),
    ).toMatchObject({
      category: "throughput",
      recognized: true,
    });
  });

  it("does not guess when a statistic is unknown", () => {
    expect(
      interpretStatisticRow({
        Name: "SomeMetric",
        Type: "Unrecognized Statistic",
        Source: "Unknown",
      }),
    ).toMatchObject({
      category: "unknown",
      recognized: false,
    });
  });

  it("matches types without depending on letter case", () => {
    expect(
      interpretStatisticRow({
        Name: "assembler",
        Type: "number busy",
        Source: "resource",
      }).recognized,
    ).toBe(true);
  });
});

describe("interpretContinuousTimeRow", () => {
  it("separates replication and overall statistics", () => {
    const result = interpretContinuousTimeRow({
      Name: "assembler",
      Type: "Number Scheduled",
      Source: "Resource",
      Replication: 1,
      Average: 1.58,
      AverageOfAverage: 1.53,
      SummaryHalfWidth: 0.13,
    });

    expect(result).toEqual({
      name: "assembler",
      type: "Number Scheduled",
      source: "Resource",
      replication: 1,
      replicationAverage: 1.58,
      overallAverage: 1.53,
      overallHalfWidth: {
        status: "available",
        value: 0.13,
      },
    });
  });

  it("does not replace missing values with zero", () => {
    const result = interpretContinuousTimeRow({
      Name: "assembler",
      Type: "Number Busy",
      Source: "Resource",
      Replication: 1,
      Average: null,
      AverageOfAverage: null,
      SummaryHalfWidth: null,
    });

    expect(result.replicationAverage).toBeNull();
    expect(result.overallAverage).toBeNull();
    expect(result.overallHalfWidth.status).toBe("unavailable");
  });
});

describe("groupContinuousTimeStats", () => {
  it("groups replications of the same statistic", () => {
    const groups = groupContinuousTimeStats([
      {
        Name: "assembler",
        Type: "Number Scheduled",
        Source: "Resource",
        Replication: 1,
        Average: 1,
        AverageOfAverage: 1.5,
        SummaryHalfWidth: 0.2,
      },
      {
        Name: "assembler",
        Type: "Number Scheduled",
        Source: "Resource",
        Replication: 2,
        Average: 2,
        AverageOfAverage: 1.5,
        SummaryHalfWidth: 0.2,
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.replicationCount).toBe(2);
    expect(groups[0]?.replications.map((item) => item.replication)).toEqual([
      1, 2,
    ]);
  });

  it("keeps different statistic types separate", () => {
    const groups = groupContinuousTimeStats([
      {
        Name: "assembler",
        Type: "Number Busy",
        Source: "Resource",
        Replication: 1,
      },
      {
        Name: "assembler",
        Type: "Number Scheduled",
        Source: "Resource",
        Replication: 1,
      },
    ]);

    expect(groups).toHaveLength(2);
  });

  it("does not group rows missing identifying fields", () => {
    const groups = groupContinuousTimeStats([
      {
        Name: null,
        Type: "Number Busy",
        Source: "Resource",
        Replication: 1,
      },
    ]);

    expect(groups).toHaveLength(0);
  });
});

describe("buildReportSemanticSummary", () => {
  it("summarizes continuous statistics without changing the source report", () => {
    const report = {
      schemaVersion: 1,
      sourceFormat: "xlsm",
      metadata: {
        projectName: "Example Project",
        modelFile: null,
        modelRunDate: "2025-06-09 14:43:37",
        timeUnits: 3,
        timeUnitLabel: "Hours",
        numberOfReplications: 2,
        averageStatCollectionLength: 8000,
        confidenceInterval: 0.95,
      },
      tables: {
        discreteTimeStats: { sourceWorksheet: "", columns: [], rows: [] },
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
            {
              Name: null,
              Type: "Number Busy",
              Source: "Resource",
              Replication: 1,
              Average: 0,
            },
          ],
        },
        counterStats: { sourceWorksheet: "", columns: [], rows: [] },
        outputStats: { sourceWorksheet: "", columns: [], rows: [] },
        frequencyStats: { sourceWorksheet: "", columns: [], rows: [] },
      },
      summary: {
        schemaVersion: 1,
        sections: {
          replicationAveragesWithObservations: {
            sourceWorksheet: "AcrossReplicationsSummary",
            startColumn: "A",
            endColumn: "M",
            columns: [],
            rows: [],
          },
          replicationAverages: {
            sourceWorksheet: "AcrossReplicationsSummary",
            startColumn: "O",
            endColumn: "Y",
            columns: [],
            rows: [],
          },
          continuousAcrossReplications: {
            sourceWorksheet: "AcrossReplicationsSummary",
            startColumn: "AA",
            endColumn: "AI",
            columns: [],
            rows: [],
          },
          discreteAcrossReplications: {
            sourceWorksheet: "AcrossReplicationsSummary",
            startColumn: "AK",
            endColumn: "AS",
            columns: [],
            rows: [],
          },
          frequencySummary: {
            sourceWorksheet: "AcrossReplicationsSummary",
            startColumn: "AU",
            endColumn: "AZ",
            columns: [],
            rows: [],
          },
        },
      },
      warnings: [],
    } satisfies import("../../src/models/NormalizedReport.js").NormalizedReport;

    const originalRows = structuredClone(
      report.tables.continuousTimeStats.rows,
    );

    const result = buildReportSemanticSummary(report);

    expect(result.declaredReplicationCount).toBe(2);
    expect(result.totalContinuousRows).toBe(3);
    expect(result.groupedContinuousRows).toBe(2);
    expect(result.skippedContinuousRows).toBe(1);
    expect(result.continuousStatistics).toHaveLength(1);
    expect(result.continuousStatistics[0]?.replicationCount).toBe(2);
    expect(report.tables.continuousTimeStats.rows).toEqual(originalRows);
  });
});

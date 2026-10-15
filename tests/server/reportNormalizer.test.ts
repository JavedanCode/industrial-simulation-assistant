import { describe, expect, it } from "vitest";
import type {
  RawCell,
  RawCellValue,
  RawWorkbook,
  RawWorksheet,
} from "../../src/models/RawWorkbook.js";
import { normalizeReport } from "../../src/server/services/reportNormalizerService.js";

function createCell(address: string, value: RawCellValue): RawCell {
  return {
    address,
    value,
    type: value === null ? "Null" : typeof value,
  };
}

function createWorksheet(name: string, data: RawCellValue[][]): RawWorksheet {
  const columnCount = Math.max(0, ...data.map((row) => row.length));

  return {
    name,
    rowCount: data.length,
    columnCount,
    rows: data.map((values, rowIndex) => ({
      excelRow: rowIndex + 1,
      cells: Array.from({ length: columnCount }, (_, columnIndex) =>
        createCell(
          `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`,
          values[columnIndex] ?? null,
        ),
      ),
    })),
  };
}

function createTestWorkbook(): RawWorkbook {
  return {
    schemaVersion: 1,
    sourceFormat: "xlsm",
    worksheets: [
      createWorksheet("ProjectInformation", [
        [
          "Project Name",
          "Model Filename",
          "Project RunDateTime",
          "TimeUnits",
          "RepsRequested",
          "AverageStatCollectionLength",
          "ConfidenceInterval",
        ],
        ["Factory Model", "factory.doe", "2026-10-15", 3, 15, 8000, 0.95],
      ]),
      createWorksheet("DiscreteTimeStatsByRep", [
        ["Replication", "Name", "Type", "Source", "Average"],
      ]),
      createWorksheet("ContinuousTimeStatsByRep", [
        ["Replication", "Name", "Type", "Source", "Average", "Average"],
        [1, "assembler", "Utilization", "Resource", 0, 12.5],
        [null, null, null, null, null, null],
        [1, "welder", "Utilization", "Resource", 25, 30],
      ]),
      createWorksheet("CounterStatsByRep", [
        ["Replication", "Name", "Type", "Source", "RecordedValue"],
        [1, "PartsCompleted", "Counter", "Model", 0],
      ]),
      createWorksheet("OutputStatsByRep", [
        ["Replication", "Name", "Type", "Source", "RecordedValue"],
      ]),
      createWorksheet("FrequencyStatsByRep", []),
    ],
  };
}

describe("normalizeReport", () => {
  it("extracts project metadata without changing raw values", () => {
    const report = normalizeReport(createTestWorkbook());

    expect(report.sourceFormat).toBe("xlsm");
    expect(report.metadata).toEqual({
      projectName: "Factory Model",
      modelFile: "factory.doe",
      modelRunDate: "2026-10-15",
      timeUnits: 3,
      numberOfReplications: 15,
      averageStatCollectionLength: 8000,
      confidenceInterval: 0.95,
    });
  });

  it("handles duplicate headers and skips completely empty rows", () => {
    const report = normalizeReport(createTestWorkbook());
    const table = report.tables.continuousTimeStats;

    expect(table.columns).toEqual([
      "Replication",
      "Name",
      "Type",
      "Source",
      "Average",
      "Average__2",
    ]);

    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]).toEqual({
      Replication: 1,
      Name: "assembler",
      Type: "Utilization",
      Source: "Resource",
      Average: 0,
      Average__2: 12.5,
    });
  });

  it("preserves zero values and represents empty sheets safely", () => {
    const report = normalizeReport(createTestWorkbook());

    expect(report.tables.counterStats.rows[0].RecordedValue).toBe(0);

    expect(report.tables.discreteTimeStats).toEqual({
      sourceWorksheet: "DiscreteTimeStatsByRep",
      columns: ["Replication", "Name", "Type", "Source", "Average"],
      rows: [],
    });

    expect(report.tables.frequencyStats).toEqual({
      sourceWorksheet: "FrequencyStatsByRep",
      columns: [],
      rows: [],
    });
  });

  it("rejects a workbook missing a required worksheet", () => {
    const workbook = createTestWorkbook();

    workbook.worksheets = workbook.worksheets.filter(
      (sheet) => sheet.name !== "CounterStatsByRep",
    );

    expect(() => normalizeReport(workbook)).toThrow(
      "Required worksheet not found: CounterStatsByRep",
    );
  });

  it("guarantees globally unique column names", () => {
    const workbook = createTestWorkbook();
    const worksheet = workbook.worksheets.find(
      (sheet) => sheet.name === "ContinuousTimeStatsByRep",
    );

    if (!worksheet) {
      throw new Error("Test worksheet was not created");
    }

    worksheet.rows[0].cells = [
      createCell("A1", "Replication"),
      createCell("B1", "Name"),
      createCell("C1", "Type"),
      createCell("D1", "Source"),
      createCell("E1", "Average"),
      createCell("F1", "Average"),
      createCell("G1", "Average__2"),
      createCell("H1", ""),
    ];

    worksheet.columnCount = 8;

    const report = normalizeReport(workbook);
    const columns = report.tables.continuousTimeStats.columns;

    expect(columns).toEqual([
      "Replication",
      "Name",
      "Type",
      "Source",
      "Average",
      "Average__2",
      "Average__2__2",
      "column_8",
    ]);

    expect(new Set(columns).size).toBe(columns.length);
  });

  it("rejects a populated statistics worksheet with unsupported headers", () => {
    const workbook = createTestWorkbook();
    const worksheet = workbook.worksheets.find(
      (sheet) => sheet.name === "ContinuousTimeStatsByRep",
    );

    if (!worksheet) {
      throw new Error("Test worksheet was not created");
    }

    worksheet.rows = [
      {
        excelRow: 1,
        cells: [
          createCell("A1", "Weekly Production Report"),
          createCell("B1", null),
          createCell("C1", null),
        ],
      },
      {
        excelRow: 2,
        cells: [
          createCell("A2", "Replication"),
          createCell("B2", "Name"),
          createCell("C2", "Average"),
        ],
      },
    ];

    expect(() => normalizeReport(workbook)).toThrow(
      /Unsupported report layout in worksheet "ContinuousTimeStatsByRep"/,
    );
  });

  it("warns about invalid metadata values", () => {
    const workbook = createTestWorkbook();

    const projectInfo = workbook.worksheets.find(
      (sheet) => sheet.name === "ProjectInformation",
    );

    if (!projectInfo) {
      throw new Error("ProjectInformation fixture is missing");
    }

    // RepsRequested is column E; ConfidenceInterval is column G.
    projectInfo.rows[1]!.cells[4]!.value = "fifteen";
    projectInfo.rows[1]!.cells[6]!.value = 1.5;

    const report = normalizeReport(workbook);

    expect(report.warnings).toHaveLength(2);

    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        code: "INVALID_VALUE",
        severity: "warning",
        worksheet: "ProjectInformation",
        field: "numberOfReplications",
      }),
    );

    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        code: "INVALID_VALUE",
        severity: "warning",
        worksheet: "ProjectInformation",
        field: "confidenceInterval",
      }),
    );
  });

  it("warns about non-numeric values in numeric statistics columns", () => {
    const workbook = createTestWorkbook();

    const continuousSheet = workbook.worksheets.find(
      (sheet) => sheet.name === "ContinuousTimeStatsByRep",
    );

    if (!continuousSheet) {
      throw new Error("ContinuousTimeStatsByRep fixture is missing");
    }

    // The Average column is E in this test fixture.
    continuousSheet.rows[1]!.cells[4]!.value = "not-a-number";

    // A legitimate zero should not generate a warning.
    continuousSheet.rows[3]!.cells[4]!.value = 0;

    const report = normalizeReport(workbook);

    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        code: "INVALID_VALUE",
        severity: "warning",
        worksheet: "ContinuousTimeStatsByRep",
        field: "Average",
      }),
    );

    expect(
      report.warnings.filter(
        (warning) =>
          warning.worksheet === "ContinuousTimeStatsByRep" &&
          warning.field === "Average",
      ),
    ).toHaveLength(1);
  });

  it("preserves parser warnings alongside normalization warnings", () => {
    const workbook = createTestWorkbook();

    workbook.warnings = [
      {
        code: "MISSING_FORMULA_RESULT",
        severity: "warning",
        message: "Formula has no cached result.",
        worksheet: "ContinuousTimeStatsByRep",
        cellAddress: "G12",
      },
    ];

    const projectInfo = workbook.worksheets.find(
      (sheet) => sheet.name === "ProjectInformation",
    );

    if (!projectInfo) {
      throw new Error("ProjectInformation fixture is missing");
    }

    // RepsRequested is column E in this fixture.
    projectInfo.rows[1]!.cells[4]!.value = "invalid";

    const report = normalizeReport(workbook);

    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        code: "MISSING_FORMULA_RESULT",
        worksheet: "ContinuousTimeStatsByRep",
        cellAddress: "G12",
      }),
    );

    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        code: "INVALID_VALUE",
        worksheet: "ProjectInformation",
        field: "numberOfReplications",
      }),
    );
  });
});

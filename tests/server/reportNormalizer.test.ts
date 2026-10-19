import { describe, expect, it } from "vitest";
import type {
  RawCell,
  RawCellValue,
  RawWorkbook,
  RawWorksheet,
} from "../../src/models/RawWorkbook.js";
import { normalizeReport } from "../../src/server/services/reportNormalizerService.js";
import type { NormalizedSummary } from "../../src/models/NormalizedSummary.js";

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

function createSummaryWorksheet(): RawWorksheet {
  const columnCount = 52;

  const headers: Record<number, string> = {
    // A:M
    1: "Project Name",
    2: "Name",
    3: "Type",
    4: "Source",
    5: "Average Of Replication Averages",
    6: "Observed=Requested",
    7: "Half-Width",
    8: "StDev Of Replication Averages",
    9: "Minimum Replication Average",
    10: "Maximum Replication Average",
    11: "Overall Min Value",
    12: "Overall Max Value",
    13: "Avg Observations Per Replication",

    // O:Y
    15: "Project Name",
    16: "Name",
    17: "Type",
    18: "Source",
    19: "Average Of Replication Averages",
    20: "Half-Width",
    21: "StDev Of Replication Averages",
    22: "Min Replication Average",
    23: "Max Replication Average",
    24: "Overall Min Value",
    25: "Overall Max Value",

    // AA:AI
    27: "Project Name",
    28: "Name",
    29: "Type",
    30: "Source",
    31: "Average Across Replications",
    32: "Half-Width",
    33: "Overall StDev Across Replications",
    34: "Min Replication Value",
    35: "Max Replication Value",

    // AK:AS
    37: "Project Name",
    38: "Name",
    39: "Type",
    40: "Source",
    41: "Average Across Replications",
    42: "Half-Width",
    43: "Overall StDev Across Replications",
    44: "Min Replication Value",
    45: "Max Replication Value",

    // AU:AZ
    47: "Project Name",
    48: "Name",
    49: "Category",
    50: "Source",
    51: "Average Standard Percentage",
    52: "Average Restricted Percentage",
  };

  const headerRow = Array.from(
    { length: columnCount },
    (_, index) => headers[index + 1] ?? null,
  );

  const dataRow = Array.from(
    { length: columnCount },
    () => null as RawCellValue,
  );

  // A:M — replication averages with observations
  dataRow[0] = "Factory Model";
  dataRow[1] = "assembler";
  dataRow[2] = "Utilization";
  dataRow[3] = "Resource";
  dataRow[4] = 75;
  dataRow[5] = "Yes";
  dataRow[6] = 5;
  dataRow[12] = 100;

  // O:Y — replication averages
  dataRow[14] = "Factory Model";
  dataRow[15] = "welder";
  dataRow[16] = "Utilization";
  dataRow[17] = "Resource";
  dataRow[18] = 60;

  // AA:AI — first across-replications section
  dataRow[26] = "Factory Model";
  dataRow[27] = "PartsCompleted";
  dataRow[28] = "Counter";
  dataRow[29] = "Model";
  dataRow[30] = 0;

  // AK:AS — second across-replications section
  dataRow[36] = "Factory Model";
  dataRow[37] = "Queue";
  dataRow[38] = "WaitingTime";
  dataRow[39] = "Queue";
  dataRow[40] = 12.5;

  // AU:AZ — frequency summary
  dataRow[46] = "Factory Model";
  dataRow[47] = "Customer";
  dataRow[48] = "Served";
  dataRow[49] = "Model";
  dataRow[50] = 80;
  dataRow[51] = 20;

  const emptyRow = Array.from(
    { length: columnCount },
    () => null as RawCellValue,
  );

  const rows = [headerRow, dataRow, emptyRow];

  return {
    name: "AcrossReplicationsSummary",
    rowCount: rows.length,
    columnCount,
    rows: rows.map((values, rowIndex) => ({
      excelRow: rowIndex + 1,
      cells: values.map((value, columnIndex) =>
        createCell(
          `${columnLetterForTest(columnIndex + 1)}${rowIndex + 1}`,
          value,
        ),
      ),
    })),
  };
}

function columnLetterForTest(columnNumber: number): string {
  let number = columnNumber;
  let result = "";

  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }

  return result;
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
      createSummaryWorksheet(),
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

  it("normalizes all five summary sections and preserves values", () => {
    const report = normalizeReport(createTestWorkbook());
    const { sections } = report.summary;

    expect(Object.keys(sections)).toHaveLength(5);

    expect(sections.replicationAveragesWithObservations).toMatchObject({
      startColumn: "A",
      endColumn: "M",
      rows: [
        expect.objectContaining({
          Name: "assembler",
          "Average Of Replication Averages": 75,
          "Avg Observations Per Replication": 100,
        }),
      ],
    });

    expect(sections.replicationAverages).toMatchObject({
      startColumn: "O",
      endColumn: "Y",
      rows: [
        expect.objectContaining({
          Name: "welder",
          "Average Of Replication Averages": 60,
        }),
      ],
    });

    expect(sections.continuousAcrossReplications).toMatchObject({
      startColumn: "AA",
      endColumn: "AI",
      rows: [
        expect.objectContaining({
          Name: "PartsCompleted",
          "Average Across Replications": 0,
        }),
      ],
    });

    expect(sections.discreteAcrossReplications).toMatchObject({
      startColumn: "AK",
      endColumn: "AS",
      rows: [
        expect.objectContaining({
          Name: "Queue",
          "Average Across Replications": 12.5,
        }),
      ],
    });

    expect(sections.frequencySummary).toMatchObject({
      startColumn: "AU",
      endColumn: "AZ",
      rows: [
        expect.objectContaining({
          Name: "Customer",
          "Average Standard Percentage": 80,
          "Average Restricted Percentage": 20,
        }),
      ],
    });

    for (const section of Object.values(sections)) {
      expect(section.rows).toHaveLength(1);
    }
  });

  it("rejects a summary section with unsupported headers", () => {
    const workbook = createTestWorkbook();

    const summarySheet = workbook.worksheets.find(
      (sheet) => sheet.name === "AcrossReplicationsSummary",
    );

    if (!summarySheet) {
      throw new Error("AcrossReplicationsSummary fixture is missing");
    }

    // Column AE belongs to the AA:AI summary section.
    // Replace its required average header with an invalid one.
    const headerCell = summarySheet.rows[0]?.cells[30];

    if (!headerCell) {
      throw new Error("Summary header cell AE1 is missing");
    }

    headerCell.value = "Unexpected Header";

    expect(() => normalizeReport(workbook)).toThrow(
      /Unsupported report layout in worksheet "AcrossReplicationsSummary".*AA:AI/s,
    );
  });

  it("rejects a workbook missing the summary worksheet", () => {
    const workbook = createTestWorkbook();

    workbook.worksheets = workbook.worksheets.filter(
      (sheet) => sheet.name !== "AcrossReplicationsSummary",
    );

    expect(() => normalizeReport(workbook)).toThrow(
      'Required worksheet not found: "AcrossReplicationsSummary"',
    );
  });
});

import type {
  RawCellValue,
  RawWorkbook,
  RawWorksheet,
} from "../../models/RawWorkbook.js";

import type {
  NormalizedReport,
  NormalizedTable,
  NormalizedTableRow,
  ReportMetadata,
} from "../../models/NormalizedReport.js";

import type { ReportWarning } from "../../models/ReportWarning";

const NUMERIC_STAT_COLUMNS: Record<string, string[]> = {
  DiscreteTimeStatsByRep: [
    "Average",
    "BatchMeansHalfWidth",
    "Minimum",
    "Maximum",
    "NumberObservations",
    "RepsRequested",
    "AverageOfAverage",
    "StDevOfAverage",
    "ConfidenceInterval",
    "HalfWidth",
    "MinimumAverage",
    "MaximumAverage",
    "OverallMinimum",
    "OverallMaximum",
    "AverageNumberObservations",
    "SummaryHalfWidth",
    "RepsWithStatObserved",
  ],
  ContinuousTimeStatsByRep: [
    "Average",
    "BatchMeansHalfWidth",
    "Minimum",
    "Maximum",
    "LastRecordedValue",
    "RepsRequested",
    "AverageOfAverage",
    "StDevOfAverage",
    "ConfidenceInterval",
    "HalfWidth",
    "MinimumAverage",
    "MaximumAverage",
    "SummaryHalfWidth",
  ],
  CounterStatsByRep: [
    "RecordedValue",
    "RepsRequested",
    "Average",
    "StandardDeviation",
    "ConfidenceInterval",
    "HalfWidth",
    "Minimum",
    "Maximum",
  ],
  OutputStatsByRep: [
    "RecordedValue",
    "RepsRequested",
    "Average",
    "StandardDeviation",
    "ConfidenceInterval",
    "HalfWidth",
    "Minimum",
    "Maximum",
  ],
  FrequencyStatsByRep: [
    "StandardPercentage",
    "RestrictedPercentage",
    "AverageTimeInCategory",
    "FrequencyCategoryCount",
    "SummaryStandardPercentage",
    "SummaryRestrictedPercentage",
    "RepsRequested",
    "AverageStandardPercentage",
    "AverageRestrictedPercentage",
  ],
};

const REQUIRED_STAT_HEADERS: Record<string, string[]> = {
  DiscreteTimeStatsByRep: ["Replication", "Name", "Type", "Source", "Average"],
  ContinuousTimeStatsByRep: [
    "Replication",
    "Name",
    "Type",
    "Source",
    "Average",
  ],
  CounterStatsByRep: ["Replication", "Name", "Type", "Source", "RecordedValue"],
  OutputStatsByRep: ["Replication", "Name", "Type", "Source", "RecordedValue"],
  FrequencyStatsByRep: [
    "Replication",
    "Name",
    "Category",
    "Source",
    "StandardPercentage",
    "RestrictedPercentage",
  ],
};

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isEmpty(value: RawCellValue): boolean {
  return value === null || (typeof value === "string" && value.trim() === "");
}

function cellText(value: RawCellValue): string {
  return value === null ? "" : String(value).trim();
}

function findHeaderRowIndex(
  worksheet: RawWorksheet,
  requiredHeaders: string[],
): number {
  return worksheet.rows.findIndex((row) => {
    const headers = row.cells
      .map((cell) => normalizeKey(cellText(cell.value)))
      .filter(Boolean);

    return requiredHeaders.every((required) =>
      headers.includes(normalizeKey(required)),
    );
  });
}

function validateHeaders(
  worksheet: RawWorksheet,
  requiredHeaders: string[],
): number {
  const headerIndex = findHeaderRowIndex(worksheet, requiredHeaders);

  if (headerIndex === -1) {
    throw new Error(
      `Unsupported report layout in worksheet "${worksheet.name}". ` +
        `Expected headers: ${requiredHeaders.join(", ")}.`,
    );
  }

  return headerIndex;
}

function getHeaderRowIndex(worksheet: RawWorksheet): number {
  return worksheet.rows.findIndex((row) =>
    row.cells.some((cell) => !isEmpty(cell.value)),
  );
}

function getUniqueColumns(headers: string[]): string[] {
  const usedNames = new Set<string>();

  return headers.map((header, index) => {
    const baseName = header || `column_${index + 1}`;
    let candidate = baseName;
    let suffix = 2;

    while (usedNames.has(candidate)) {
      candidate = `${baseName}__${suffix}`;
      suffix++;
    }

    usedNames.add(candidate);
    return candidate;
  });
}

function normalizeStatsWorksheet(
  workbook: RawWorkbook,
  worksheetName: string,
): NormalizedTable {
  const worksheet = workbook.worksheets.find(
    (sheet) => sheet.name === worksheetName,
  );

  if (!worksheet) {
    throw new Error(`Required worksheet not found: ${worksheetName}`);
  }

  const requiredHeaders = REQUIRED_STAT_HEADERS[worksheetName];

  if (!requiredHeaders) {
    throw new Error(`Unsupported statistics worksheet: "${worksheetName}".`);
  }

  // A completely blank worksheet is a valid empty table.
  const firstNonEmptyRowIndex = getHeaderRowIndex(worksheet);

  if (firstNonEmptyRowIndex === -1) {
    return {
      sourceWorksheet: worksheetName,
      columns: [],
      rows: [],
    };
  }

  // Find the expected header row, even if a title appears above it.
  const headerIndex = findHeaderRowIndex(worksheet, requiredHeaders);

  if (headerIndex === -1) {
    throw new Error(
      `Unsupported report layout in worksheet "${worksheet.name}". ` +
        `Expected headers: ${requiredHeaders.join(", ")}.`,
    );
  }

  const headerRow = worksheet.rows[headerIndex];

  const headers = getUniqueColumns(
    headerRow.cells.map((cell) => cellText(cell.value)),
  );

  const rows: NormalizedTableRow[] = [];

  for (const row of worksheet.rows.slice(headerIndex + 1)) {
    if (row.cells.every((cell) => isEmpty(cell.value))) {
      continue;
    }

    const normalizedRow: NormalizedTableRow = {};

    headers.forEach((header, index) => {
      normalizedRow[header] = row.cells[index]?.value ?? null;
    });

    rows.push(normalizedRow);
  }

  return {
    sourceWorksheet: worksheetName,
    columns: headers,
    rows,
  };
}

function findMetadataValue(
  headers: string[],
  values: RawCellValue[],
  aliases: string[],
): RawCellValue {
  const normalizedAliases = aliases.map(normalizeKey);
  const index = headers.findIndex((header) =>
    normalizedAliases.includes(normalizeKey(header)),
  );

  return index === -1 ? null : (values[index] ?? null);
}

function normalizeMetadata(workbook: RawWorkbook): ReportMetadata {
  const worksheet = workbook.worksheets.find(
    (sheet) => sheet.name === "ProjectInformation",
  );

  if (!worksheet) {
    throw new Error("Required worksheet not found: ProjectInformation");
  }

  const headerIndex = getHeaderRowIndex(worksheet);

  if (headerIndex === -1) {
    throw new Error("ProjectInformation contains no headers");
  }

  const headers = worksheet.rows[headerIndex].cells.map((cell) =>
    cellText(cell.value),
  );

  const dataRow = worksheet.rows
    .slice(headerIndex + 1)
    .find((row) => row.cells.some((cell) => !isEmpty(cell.value)));

  if (!dataRow) {
    throw new Error("ProjectInformation contains no metadata row");
  }

  const values = dataRow.cells.map((cell) => cell.value);

  return {
    projectName: findMetadataValue(headers, values, [
      "Project Name",
      "ProjectName",
    ]),
    modelFile: findMetadataValue(headers, values, [
      "ModelFile",
      "Model Filename",
      "Model File",
      "ModelName",
      "Filename",
    ]),
    modelRunDate: findMetadataValue(headers, values, [
      "ModelRunDate",
      "Project RunDateTime",
      "RunDateTime",
      "Run Date",
      "RunDate",
    ]),
    timeUnits: findMetadataValue(headers, values, ["TimeUnits", "Time Units"]),
    numberOfReplications: findMetadataValue(headers, values, [
      "RepsRequested",
      "Replications",
      "NumberOfReplications",
    ]),
    averageStatCollectionLength: findMetadataValue(headers, values, [
      "AvgStatCollectionLength",
      "AverageStatCollectionLength",
      "Average Statistical Collection Length",
      "StatCollectionLength",
    ]),
    confidenceInterval: findMetadataValue(headers, values, [
      "ConfidenceInterval",
      "ConfidenceLevel",
      "Confidence Level",
    ]),
  };
}

function validateMetadata(metadata: ReportMetadata): ReportWarning[] {
  const warnings: ReportWarning[] = [];

  function warnIfInvalid(
    field: keyof ReportMetadata,
    isValid: (value: RawCellValue) => boolean,
    expectation: string,
  ): void {
    const value = metadata[field];

    // A missing value is not automatically invalid.
    // We'll define missing-required-field rules separately.
    if (value === null) {
      return;
    }

    if (!isValid(value)) {
      warnings.push({
        code: "INVALID_VALUE",
        severity: "warning",
        message: `Metadata field "${field}" has an invalid value. Expected ${expectation}.`,
        worksheet: "ProjectInformation",
        field,
      });
    }
  }

  warnIfInvalid(
    "numberOfReplications",
    (value) =>
      typeof value === "number" && Number.isInteger(value) && value > 0,
    "a positive integer",
  );

  warnIfInvalid(
    "averageStatCollectionLength",
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
    "a positive finite number",
  );

  warnIfInvalid(
    "confidenceInterval",
    (value) =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0 &&
      value < 1,
    "a number between 0 and 1",
  );

  return warnings;
}

function validateTableValues(table: NormalizedTable): ReportWarning[] {
  const warnings: ReportWarning[] = [];
  const numericColumns = NUMERIC_STAT_COLUMNS[table.sourceWorksheet] ?? [];

  for (const [rowIndex, row] of table.rows.entries()) {
    for (const column of numericColumns) {
      if (!(column in row)) {
        continue;
      }

      const value = row[column];

      // Blank values can be legitimate in Arena statistics.
      if (
        value === null ||
        (typeof value === "string" && value.trim() === "")
      ) {
        continue;
      }

      if (typeof value !== "number" || !Number.isFinite(value)) {
        warnings.push({
          code: "INVALID_VALUE",
          severity: "warning",
          message:
            `Expected a finite number in column "${column}", ` +
            `but received ${JSON.stringify(value)}.`,
          worksheet: table.sourceWorksheet,
          field: column,
        });
      }
    }
  }

  return warnings;
}

export function normalizeReport(workbook: RawWorkbook): NormalizedReport {
  const metadata = normalizeMetadata(workbook);

  const tables = {
    discreteTimeStats: normalizeStatsWorksheet(
      workbook,
      "DiscreteTimeStatsByRep",
    ),
    continuousTimeStats: normalizeStatsWorksheet(
      workbook,
      "ContinuousTimeStatsByRep",
    ),
    counterStats: normalizeStatsWorksheet(workbook, "CounterStatsByRep"),
    outputStats: normalizeStatsWorksheet(workbook, "OutputStatsByRep"),
    frequencyStats: normalizeStatsWorksheet(workbook, "FrequencyStatsByRep"),
  };

  const warnings = [
    ...(workbook.warnings ?? []),
    ...validateMetadata(metadata),
    ...Object.values(tables).flatMap(validateTableValues),
  ];

  return {
    schemaVersion: 1,
    sourceFormat: workbook.sourceFormat,
    metadata,
    tables,
    warnings,
  };
}

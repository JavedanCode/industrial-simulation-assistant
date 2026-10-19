import type { RawCellValue, RawWorkbook } from "../../models/RawWorkbook.js";
import type {
  NormalizedSummary,
  NormalizedSummarySection,
} from "../../models/NormalizedSummary.js";

interface SummarySectionConfig {
  key: keyof NormalizedSummary["sections"];
  startColumn: number;
  endColumn: number;
  requiredHeaders: string[];
}

const SECTION_CONFIGS: SummarySectionConfig[] = [
  {
    key: "replicationAveragesWithObservations",
    startColumn: 1,
    endColumn: 13,
    requiredHeaders: [
      "Project Name",
      "Name",
      "Type",
      "Source",
      "Average Of Replication Averages",
      "Avg Observations Per Replication",
    ],
  },
  {
    key: "replicationAverages",
    startColumn: 15,
    endColumn: 25,
    requiredHeaders: [
      "Project Name",
      "Name",
      "Type",
      "Source",
      "Average Of Replication Averages",
    ],
  },
  {
    key: "continuousAcrossReplications",
    startColumn: 27,
    endColumn: 35,
    requiredHeaders: [
      "Project Name",
      "Name",
      "Type",
      "Source",
      "Average Across Replications",
    ],
  },
  {
    key: "discreteAcrossReplications",
    startColumn: 37,
    endColumn: 45,
    requiredHeaders: [
      "Project Name",
      "Name",
      "Type",
      "Source",
      "Average Across Replications",
    ],
  },
  {
    key: "frequencySummary",
    startColumn: 47,
    endColumn: 52,
    requiredHeaders: [
      "Project Name",
      "Name",
      "Category",
      "Source",
      "Average Standard Percentage",
      "Average Restricted Percentage",
    ],
  },
];

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isEmpty(value: RawCellValue): boolean {
  return (
    value === null ||
    (typeof value === "string" &&
      (value.trim() === "" || value.trim().toLowerCase() === "(blank)"))
  );
}

function columnLetter(columnNumber: number): string {
  let number = columnNumber;
  let result = "";

  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }

  return result;
}

function extractSection(
  workbook: RawWorkbook,
  config: SummarySectionConfig,
): NormalizedSummarySection {
  const worksheet = workbook.worksheets.find(
    (sheet) => sheet.name === "AcrossReplicationsSummary",
  );

  if (!worksheet) {
    throw new Error(
      'Required worksheet not found: "AcrossReplicationsSummary"',
    );
  }

  const headerIndex = worksheet.rows.findIndex((row) => {
    const headers = row.cells
      .slice(config.startColumn - 1, config.endColumn)
      .map((cell) =>
        normalizeKey(cell.value === null ? "" : String(cell.value).trim()),
      );

    return config.requiredHeaders.every((required) =>
      headers.includes(normalizeKey(required)),
    );
  });

  if (headerIndex === -1) {
    throw new Error(
      `Unsupported report layout in worksheet "AcrossReplicationsSummary" ` +
        `for columns ${columnLetter(config.startColumn)}:` +
        `${columnLetter(config.endColumn)}. ` +
        `Expected headers: ${config.requiredHeaders.join(", ")}.`,
    );
  }

  const headerCells = worksheet.rows[headerIndex].cells.slice(
    config.startColumn - 1,
    config.endColumn,
  );

  const columns = headerCells.map((cell, index) => {
    const value = cell.value === null ? "" : String(cell.value).trim();
    return value || `column_${config.startColumn + index}`;
  });

  const rows: Record<string, RawCellValue>[] = [];

  for (const row of worksheet.rows.slice(headerIndex + 1)) {
    const sectionCells = row.cells.slice(
      config.startColumn - 1,
      config.endColumn,
    );

    if (sectionCells.every((cell) => isEmpty(cell.value))) {
      continue;
    }

    const normalizedRow: Record<string, RawCellValue> = {};

    columns.forEach((column, index) => {
      normalizedRow[column] = sectionCells[index]?.value ?? null;
    });

    rows.push(normalizedRow);
  }

  return {
    sourceWorksheet: "AcrossReplicationsSummary",
    startColumn: columnLetter(config.startColumn),
    endColumn: columnLetter(config.endColumn),
    columns,
    rows,
  };
}

export function normalizeSummary(workbook: RawWorkbook): NormalizedSummary {
  const sections = Object.fromEntries(
    SECTION_CONFIGS.map((config) => [
      config.key,
      extractSection(workbook, config),
    ]),
  ) as NormalizedSummary["sections"];

  return {
    schemaVersion: 1,
    sections,
  };
}

import ExcelJS from "exceljs";

export interface TestReportOptions {
  projectName?: string;
  replications?: number;
  timeUnits?: number;
}

function addSummarySectionHeaders(
  sheet: ExcelJS.Worksheet,
  startColumn: number,
  headers: string[],
): void {
  headers.forEach((header, index) => {
    sheet.getCell(1, startColumn + index).value = header;
  });
}

/**
 * Builds a small workbook with the same worksheet layout as an Arena report.
 */
export async function createTestReport(
  options: TestReportOptions = {},
): Promise<Buffer> {
  const {
    projectName = "Test Project",
    replications = 2,
    timeUnits = 3,
  } = options;

  const workbook = new ExcelJS.Workbook();

  const projectInfo = workbook.addWorksheet("ProjectInformation");
  projectInfo.addRow([
    "ProjectName",
    "ModelFile",
    "ModelRunDate",
    "TimeUnits",
    "RepsRequested",
    "AvgStatCollectionLength",
    "ConfidenceInterval",
  ]);
  projectInfo.addRow([
    projectName,
    "test.p",
    "2026-01-01",
    timeUnits,
    replications,
    100,
    0.95,
  ]);

  const summarySheets = [
    "AcrossReplicationsSummary",
    "DiscreteTimeStatsByRep",
    "ContinuousTimeStatsByRep",
    "CounterStatsByRep",
    "OutputStatsByRep",
    "FrequencyStatsByRep",
  ];

  for (const name of summarySheets) {
    const sheet = workbook.addWorksheet(name);

    if (name === "AcrossReplicationsSummary") {
      addSummarySectionHeaders(sheet, 1, [
        "Project Name",
        "Name",
        "Type",
        "Source",
        "Average Of Replication Averages",
        "Avg Observations Per Replication",
      ]);

      addSummarySectionHeaders(sheet, 15, [
        "Project Name",
        "Name",
        "Type",
        "Source",
        "Average Of Replication Averages",
      ]);

      addSummarySectionHeaders(sheet, 27, [
        "Project Name",
        "Name",
        "Type",
        "Source",
        "Average Across Replications",
      ]);

      addSummarySectionHeaders(sheet, 37, [
        "Project Name",
        "Name",
        "Type",
        "Source",
        "Average Across Replications",
      ]);

      addSummarySectionHeaders(sheet, 47, [
        "Project Name",
        "Name",
        "Category",
        "Source",
        "Average Standard Percentage",
        "Average Restricted Percentage",
      ]);
    } else if (name === "ContinuousTimeStatsByRep") {
      sheet.addRow(["Replication", "Name", "Type", "Source", "Average"]);
      sheet.addRow([1, "Assembler", "Resource", "Assembler", 0.75]);
      sheet.addRow([2, "Assembler", "Resource", "Assembler", 0.8]);
    } else if (name === "DiscreteTimeStatsByRep") {
      sheet.addRow(["Replication", "Name", "Type", "Source", "Average"]);
    } else if (name === "CounterStatsByRep" || name === "OutputStatsByRep") {
      sheet.addRow(["Replication", "Name", "Type", "Source", "RecordedValue"]);
    } else if (name === "FrequencyStatsByRep") {
      sheet.addRow([
        "Replication",
        "Name",
        "Category",
        "Source",
        "StandardPercentage",
        "RestrictedPercentage",
      ]);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return Buffer.from(buffer);
}

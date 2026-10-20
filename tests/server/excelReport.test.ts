import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/server/app.js";

function addSummarySectionHeaders(
  sheet: ExcelJS.Worksheet,
  startColumn: number,
  headers: string[],
): void {
  headers.forEach((header, index) => {
    sheet.getCell(1, startColumn + index).value = header;
  });
}

async function createTestReport(): Promise<Buffer> {
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
  projectInfo.addRow(["Test Project", "test.p", "2026-01-01", 3, 2, 100, 0.95]);

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

describe("POST /api/reports/analyze", () => {
  it("accepts a valid Excel report and returns its analysis", async () => {
    const reportBuffer = await createTestReport();

    const response = await request(app)
      .post("/api/reports/analyze")
      .attach("report", reportBuffer, {
        filename: "test-report.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(response.status).toBe(200);
    expect(response.body.report.metadata.projectName).toBe("Test Project");
    expect(response.body.semantics.projectName).toBe("Test Project");
    expect(response.body.semantics.declaredReplicationCount).toBe(2);
    expect(response.body.semantics.totalContinuousRows).toBe(2);
  });

  it("rejects a request without a report file", async () => {
    const response = await request(app).post("/api/reports/analyze");

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Missing report file");
  });

  it("rejects an unsupported file extension", async () => {
    const response = await request(app)
      .post("/api/reports/analyze")
      .attach("report", Buffer.from("not an Excel workbook"), {
        filename: "report.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Unsupported report format");
  });

  it("rejects a file that is not a valid Excel workbook", async () => {
    const response = await request(app)
      .post("/api/reports/analyze")
      .attach("report", Buffer.from("This is not an Excel workbook"), {
        filename: "invalid-report.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });
});

import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/server/app.js";
import { closeDatabase } from "../../src/server/storage/database.js";
import { createTestReport } from "../helpers/createTestReport.js";

afterAll(() => {
  closeDatabase();
});

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

    expect(response.status).toBe(201);
    expect(response.body.report.metadata.projectName).toBe("Test Project");
    expect(response.body.semantics.projectName).toBe("Test Project");
    expect(response.body.semantics.declaredReplicationCount).toBe(2);
    expect(response.body.semantics.totalContinuousRows).toBe(2);
    expect(response.body.insights.resources).toHaveLength(1);
    expect(response.body.insights.resources[0].name).toBe("Assembler");
    expect(
      response.body.insights.resources[0].instantaneousUtilization.average,
    ).toBeCloseTo(0.775, 4);
    expect(response.body.insights.bottleneck.resource.name).toBe("Assembler");
    expect(response.body.insights.bottleneck.summary).toContain(
      "most utilized resource",
    );
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

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty("error");
  });
});

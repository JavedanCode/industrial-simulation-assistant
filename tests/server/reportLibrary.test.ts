import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/server/app.js";
import {
  closeDatabase,
  resetDatabaseForTests,
} from "../../src/server/storage/database.js";
import { createTestReport } from "../helpers/createTestReport.js";
import { uploadTestReport } from "../helpers/api.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

beforeEach(() => {
  resetDatabaseForTests();
});

afterAll(() => {
  closeDatabase();
});

describe("report library", () => {
  it("stores an analyzed report and returns its ID", async () => {
    const reportBuffer = await createTestReport({ projectName: "Library Test" });

    const response = await request(app)
      .post("/api/reports/analyze")
      .attach("report", reportBuffer, {
        filename: "library-test.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(response.status).toBe(201);
    expect(response.body.reportId).toMatch(UUID_PATTERN);
    expect(response.body.report.metadata.projectName).toBe("Library Test");
  });

  it("returns a stored report by ID", async () => {
    const reportId = await uploadTestReport(app, "Stored Project");

    const response = await request(app).get(`/api/reports/${reportId}`);

    expect(response.status).toBe(200);
    expect(response.body.reportId).toBe(reportId);
    expect(response.body.fileName).toBe("test-report.xlsx");
    expect(response.body.report.metadata.projectName).toBe("Stored Project");
    expect(response.body.semantics.projectName).toBe("Stored Project");
    expect(response.body.insights.resources[0].name).toBe("Assembler");
    expect(response.body.insights.bottleneck.resource.name).toBe("Assembler");
  });

  it("lists stored reports", async () => {
    await uploadTestReport(app, "First Project");
    await uploadTestReport(app, "Second Project");

    const response = await request(app).get("/api/reports");

    expect(response.status).toBe(200);
    expect(response.body.reports).toHaveLength(2);
    expect(
      response.body.reports.map(
        (report: { projectName: string | null }) => report.projectName,
      ),
    ).toEqual(expect.arrayContaining(["First Project", "Second Project"]));
  });

  it("deletes a stored report", async () => {
    const reportId = await uploadTestReport(app);

    const deleteResponse = await request(app).delete(
      `/api/reports/${reportId}`,
    );

    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app).get(`/api/reports/${reportId}`);

    expect(getResponse.status).toBe(404);

    const secondDelete = await request(app).delete(
      `/api/reports/${reportId}`,
    );

    expect(secondDelete.status).toBe(404);
  });

  it("rejects a malformed report ID", async () => {
    const response = await request(app).get("/api/reports/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_ID");
  });

  it("returns 404 for an unknown report ID", async () => {
    const response = await request(app).get(`/api/reports/${randomUUID()}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Report not found.");
  });
});

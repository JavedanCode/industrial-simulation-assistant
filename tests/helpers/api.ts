import request from "supertest";
import type { Express } from "express";
import { expect } from "vitest";
import { createTestReport } from "./createTestReport.js";

export async function uploadTestReport(
  app: Express,
  projectName = "Test Project",
): Promise<string> {
  const reportBuffer = await createTestReport({ projectName });

  const response = await request(app)
    .post("/api/reports/analyze")
    .attach("report", reportBuffer, {
      filename: "test-report.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

  expect(response.status).toBe(201);

  return response.body.reportId as string;
}

export async function createTestConversation(
  app: Express,
  reportId: string,
  title?: string,
): Promise<string> {
  const response = await request(app)
    .post(`/api/reports/${reportId}/conversations`)
    .send(title ? { title } : {});

  expect(response.status).toBe(201);

  return response.body.conversation.conversationId as string;
}

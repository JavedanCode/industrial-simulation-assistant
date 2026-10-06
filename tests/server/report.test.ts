import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/server/app.js";
import { raw } from "express";

describe("POST /api/reports/parse", () => {
  it("accepts report text and returns basic report information", async () => {
    const response = await request(app).post("/api/reports/parse").send({
      reportText: "This is a test Arena report.",
    });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      rawText: "This is a test Arena report.",
    });
  });

  it("rejects a request without report text", async () => {
    const response = await request(app).post("/api/reports/parse").send({});
    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "reportText must be a non-empty string",
    });
  });

  it("rejects non-string report text", async () => {
    const response = await request(app).post("/api/reports/parse").send({
      reportText: 123,
    });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "reportText must be a non-empty string",
    });
  });
});

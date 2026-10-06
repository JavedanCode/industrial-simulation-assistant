import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/server/app.js";

describe("POST /api/chat", () => {
  it("accepts a valid message and returns a response", async () => {
    const response = await request(app).post("/api/chat").send({
      message: "What is utilization?",
    });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      response: "AI received your message: What is utilization?",
    });
  });

  it("rejects a request without a message", async () => {
    const response = await request(app).post("/api/chat").send({});

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "message must be a non-empty string",
    });
  });

  it("rejects non-string messages", async () => {
    const response = await request(app).post("/api/chat").send({
      message: 123,
    });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "message must be a non-empty string",
    });
  });
});

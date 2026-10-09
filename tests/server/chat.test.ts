import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/server/app.js";

const validRequest = {
  conversationId: "550e8400-e29b-41d4-a716-446655440000",
  reportId: "550e8400-e29b-41d4-a716-446655440001",
  message: {
    id: "550e8400-e29b-41d4-a716-446655440002",
    role: "user",
    content: "What is utilization?",
    createdAt: "2026-10-09T16:00:00Z",
  },
  history: [],
};

describe("POST /api/chat", () => {
  it("accepts a valid chat request", async () => {
    const response = await request(app).post("/api/chat").send(validRequest);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      response: "AI received your message: What is utilization?",
    });
  });

  it("rejects a request with a missing message", async () => {
    const { message: _message, ...requestWithoutMessage } = validRequest;

    const response = await request(app)
      .post("/api/chat")
      .send(requestWithoutMessage);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid chat request");
  });

  it("rejects an invalid conversation ID", async () => {
    const response = await request(app)
      .post("/api/chat")
      .send({
        ...validRequest,
        conversationId: "not-a-uuid",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid chat request");
  });

  it("rejects an assistant message as the current message", async () => {
    const response = await request(app)
      .post("/api/chat")
      .send({
        ...validRequest,
        message: {
          ...validRequest.message,
          role: "assistant",
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid chat request");
  });
});

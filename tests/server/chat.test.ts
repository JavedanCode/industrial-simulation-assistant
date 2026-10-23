import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/server/app.js";
import {
  closeDatabase,
  resetDatabaseForTests,
} from "../../src/server/storage/database.js";
import {
  createTestConversation,
  uploadTestReport,
} from "../helpers/api.js";

const message = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  role: "user",
  content: "What is utilization?",
  createdAt: "2026-10-09T16:00:00Z",
};

beforeEach(() => {
  resetDatabaseForTests();
});

afterAll(() => {
  closeDatabase();
});

async function createChatContext() {
  const reportId = await uploadTestReport(app);
  const conversationId = await createTestConversation(app, reportId);

  return { reportId, conversationId };
}

describe("POST /api/chat (deprecated)", () => {
  it("accepts a valid chat request and replies from the report", async () => {
    const { reportId, conversationId } = await createChatContext();

    const response = await request(app).post("/api/chat").send({
      conversationId,
      reportId,
      message,
      history: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.response).toContain("Test Project");
    expect(response.body.response).toContain("What is utilization?");
    expect(response.body.userMessage.role).toBe("user");
    expect(response.body.assistantMessage.role).toBe("assistant");
  });

  it("rejects a request with a missing message", async () => {
    const response = await request(app).post("/api/chat").send({
      conversationId: randomUUID(),
      reportId: randomUUID(),
      history: [],
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid chat request");
  });

  it("rejects an invalid conversation ID", async () => {
    const response = await request(app).post("/api/chat").send({
      conversationId: "not-a-uuid",
      reportId: randomUUID(),
      message,
      history: [],
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid chat request");
  });

  it("rejects an assistant message as the current message", async () => {
    const response = await request(app)
      .post("/api/chat")
      .send({
        conversationId: randomUUID(),
        reportId: randomUUID(),
        message: {
          ...message,
          role: "assistant",
        },
        history: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid chat request");
  });

  it("returns 404 when the conversation does not exist", async () => {
    const response = await request(app).post("/api/chat").send({
      conversationId: randomUUID(),
      reportId: randomUUID(),
      message,
      history: [],
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Conversation not found.");
  });

  it("rejects a report ID that does not match the conversation", async () => {
    const { conversationId } = await createChatContext();

    const response = await request(app).post("/api/chat").send({
      conversationId,
      reportId: randomUUID(),
      message,
      history: [],
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("REPORT_MISMATCH");
  });
});

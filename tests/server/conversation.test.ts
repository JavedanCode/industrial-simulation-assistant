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

beforeEach(() => {
  resetDatabaseForTests();
});

afterAll(() => {
  closeDatabase();
});

describe("conversations", () => {
  it("creates a conversation for a stored report", async () => {
    const reportId = await uploadTestReport(app);

    const response = await request(app)
      .post(`/api/reports/${reportId}/conversations`)
      .send({ title: "Bottleneck review" });

    expect(response.status).toBe(201);
    expect(response.body.conversation.reportId).toBe(reportId);
    expect(response.body.conversation.title).toBe("Bottleneck review");
    expect(response.body.conversation.conversationId).toBeTruthy();
  });

  it("lists conversations for a report", async () => {
    const reportId = await uploadTestReport(app);
    await createTestConversation(app, reportId, "First");
    await createTestConversation(app, reportId, "Second");

    const response = await request(app).get(
      `/api/reports/${reportId}/conversations`,
    );

    expect(response.status).toBe(200);
    expect(response.body.conversations).toHaveLength(2);
    expect(
      response.body.conversations.map(
        (conversation: { title: string | null }) => conversation.title,
      ),
    ).toEqual(expect.arrayContaining(["First", "Second"]));
  });

  it("stores the user message and a grounded assistant reply", async () => {
    const reportId = await uploadTestReport(app, "Conversation Project");
    const conversationId = await createTestConversation(app, reportId);

    const response = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .send({ content: "Which resource is the bottleneck?" });

    expect(response.status).toBe(201);
    expect(response.body.userMessage.role).toBe("user");
    expect(response.body.userMessage.content).toBe(
      "Which resource is the bottleneck?",
    );
    expect(response.body.assistantMessage.role).toBe("assistant");
    expect(response.body.assistantMessage.content).toContain(
      "Conversation Project",
    );
    expect(response.body.assistantMessage.content).toContain(
      "Which resource is the bottleneck?",
    );
  });

  it("returns the conversation with its messages in order", async () => {
    const reportId = await uploadTestReport(app);
    const conversationId = await createTestConversation(app, reportId);

    await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .send({ content: "First question" });

    await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .send({ content: "Second question" });

    const response = await request(app).get(
      `/api/conversations/${conversationId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.conversation.conversationId).toBe(conversationId);
    expect(response.body.messages).toHaveLength(4);
    expect(
      response.body.messages.map(
        (message: { role: string; content: string }) => message.role,
      ),
    ).toEqual(["user", "assistant", "user", "assistant"]);
    expect(response.body.messages[0].content).toBe("First question");
    expect(response.body.messages[2].content).toBe("Second question");
  });

  it("uses the first message as the title when none was given", async () => {
    const reportId = await uploadTestReport(app);
    const conversationId = await createTestConversation(app, reportId);

    await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .send({ content: "Why is utilization so high?" });

    const response = await request(app).get(
      `/api/conversations/${conversationId}`,
    );

    expect(response.body.conversation.title).toBe(
      "Why is utilization so high?",
    );
  });

  it("deletes a conversation", async () => {
    const reportId = await uploadTestReport(app);
    const conversationId = await createTestConversation(app, reportId);

    const deleteResponse = await request(app).delete(
      `/api/conversations/${conversationId}`,
    );

    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app).get(
      `/api/conversations/${conversationId}`,
    );

    expect(getResponse.status).toBe(404);
  });

  it("deletes conversations when their report is deleted", async () => {
    const reportId = await uploadTestReport(app);
    const conversationId = await createTestConversation(app, reportId);

    await request(app).delete(`/api/reports/${reportId}`);

    const response = await request(app).get(
      `/api/conversations/${conversationId}`,
    );

    expect(response.status).toBe(404);
  });

  it("rejects a conversation for an unknown report", async () => {
    const response = await request(app)
      .post(`/api/reports/${randomUUID()}/conversations`)
      .send({});

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Report not found.");
  });

  it("rejects an empty message", async () => {
    const reportId = await uploadTestReport(app);
    const conversationId = await createTestConversation(app, reportId);

    const response = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .send({ content: "   " });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a message for an unknown conversation", async () => {
    const response = await request(app)
      .post(`/api/conversations/${randomUUID()}/messages`)
      .send({ content: "Hello?" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Conversation not found.");
  });

  it("rejects a malformed conversation ID", async () => {
    const response = await request(app).get("/api/conversations/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_ID");
  });
});

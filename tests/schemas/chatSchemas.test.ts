import { describe, expect, it } from "vitest";
import { chatRequestSchema } from "../../src/schemas/chatSchemas.js";

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

describe("chatRequestSchema", () => {
  it("accepts a valid chat request", () => {
    expect(chatRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("rejects an invalid conversation ID", () => {
    const request = {
      ...validRequest,
      conversationId: "not-a-uuid",
    };

    expect(chatRequestSchema.safeParse(request).success).toBe(false);
  });

  it("rejects an empty message", () => {
    const request = {
      ...validRequest,
      message: {
        ...validRequest.message,
        content: "   ",
      },
    };

    expect(chatRequestSchema.safeParse(request).success).toBe(false);
  });

  it("rejects an assistant message as the current message", () => {
    const request = {
      ...validRequest,
      message: {
        ...validRequest.message,
        role: "assistant",
      },
    };

    expect(chatRequestSchema.safeParse(request).success).toBe(false);
  });
});

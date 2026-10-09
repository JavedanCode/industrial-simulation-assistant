import { z } from "zod";

export const chatMessageSchema = z.object({
  id: z.uuid(),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(10_000),
  createdAt: z.string().datetime({ offset: true }),
});

export const chatRequestSchema = z.object({
  conversationId: z.uuid(),
  reportId: z.uuid(),
  message: chatMessageSchema.extend({
    role: z.literal("user"),
  }),
  history: z.array(chatMessageSchema).max(100),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;

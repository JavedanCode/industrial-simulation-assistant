import { z } from "zod";

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(10_000),
});

export type CreateConversationRequest = z.infer<
  typeof createConversationSchema
>;
export type SendMessageRequest = z.infer<typeof sendMessageSchema>;

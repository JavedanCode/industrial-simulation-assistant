import type { ChatRequest } from "../../schemas/chatSchemas.js";
import { generateResponse } from "./aiService.js";

export function processMessage(request: ChatRequest): string {
  return generateResponse(request.message.content);
}

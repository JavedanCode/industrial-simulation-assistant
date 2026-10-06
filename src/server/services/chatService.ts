import { generateResponse } from "./aiService.js";

export function processMessage(message: string): string {
  return generateResponse(message);
}

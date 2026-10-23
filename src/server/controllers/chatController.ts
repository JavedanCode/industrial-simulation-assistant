import type { Request, Response } from "express";
import { chatRequestSchema } from "../../schemas/chatSchemas.js";
import { processMessage } from "../services/chatService.js";

export async function chatController(
  req: Request,
  res: Response,
): Promise<void> {
  const validation = chatRequestSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({
      error: "Invalid chat request",
      details: validation.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  const response = await processMessage(validation.data);

  res.json(response);
}

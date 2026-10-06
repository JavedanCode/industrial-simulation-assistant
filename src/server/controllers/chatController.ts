import { Request, Response } from "express";
import { processMessage } from "../services/chatService.js";

export function chatController(req: Request, res: Response): void {
  const { message } = req.body;

  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({
      error: "message must be a non-empty string",
    });
    return;
  }

  const response = processMessage(message);

  res.json({
    response,
  });
}

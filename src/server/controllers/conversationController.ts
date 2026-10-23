import type { Request, Response } from "express";
import {
  createConversationSchema,
  sendMessageSchema,
} from "../../schemas/conversationSchemas.js";
import { parseBody, parseUuidParam } from "../http/validation.js";
import {
  createConversation,
  deleteConversation,
  getConversationDetail,
  listReportConversations,
  sendConversationMessage,
} from "../services/conversationService.js";

export function createConversationController(
  req: Request,
  res: Response,
): void {
  const reportId = parseUuidParam(req.params.reportId, "reportId");
  const { title } = parseBody(createConversationSchema, req.body ?? {});
  const conversation = createConversation(reportId, title);

  res.status(201).json({ conversation });
}

export function listConversationsController(
  req: Request,
  res: Response,
): void {
  const reportId = parseUuidParam(req.params.reportId, "reportId");

  res.json({
    conversations: listReportConversations(reportId),
  });
}

export function getConversationController(
  req: Request,
  res: Response,
): void {
  const conversationId = parseUuidParam(
    req.params.conversationId,
    "conversationId",
  );

  res.json(getConversationDetail(conversationId));
}

export function deleteConversationController(
  req: Request,
  res: Response,
): void {
  const conversationId = parseUuidParam(
    req.params.conversationId,
    "conversationId",
  );

  deleteConversation(conversationId);

  res.status(204).send();
}

export async function sendMessageController(
  req: Request,
  res: Response,
): Promise<void> {
  const conversationId = parseUuidParam(
    req.params.conversationId,
    "conversationId",
  );
  const { content } = parseBody(sendMessageSchema, req.body ?? {});
  const result = await sendConversationMessage(conversationId, content);

  res.status(201).json(result);
}

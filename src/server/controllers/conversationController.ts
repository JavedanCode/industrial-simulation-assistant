import type { Request, Response } from "express";
import { requestKey, readReceipt, saveReceipt } from "../http/idempotency.js";
import { withTransaction } from "../storage/database.js";
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
  const key = requestKey(req.get("Idempotency-Key"));
  const scope = `conversation:${reportId}`;
  const fingerprint = JSON.stringify({ title });
  const response = withTransaction(() => {
    const existing = readReceipt(scope, key, fingerprint);
    if (existing) return existing;
    const result = { conversation: createConversation(reportId, title) };
    saveReceipt(scope, key, fingerprint, reportId, result);
    return result;
  });
  res.status(201).json(response);
}

export function listConversationsController(req: Request, res: Response): void {
  const reportId = parseUuidParam(req.params.reportId, "reportId");

  res.json({
    conversations: listReportConversations(reportId),
  });
}

export function getConversationController(req: Request, res: Response): void {
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
  const { content, clientMsgId } = parseBody(sendMessageSchema, req.body ?? {});
  const result = await sendConversationMessage(
    conversationId,
    content,
    clientMsgId,
  );

  res.status(201).json(result);
}

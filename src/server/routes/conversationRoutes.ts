import { Router } from "express";
import {
  deleteConversationController,
  getConversationController,
  sendMessageController,
} from "../controllers/conversationController.js";

const router = Router();

router.get("/conversations/:conversationId", getConversationController);
router.delete("/conversations/:conversationId", deleteConversationController);
router.post(
  "/conversations/:conversationId/messages",
  sendMessageController,
);

export default router;

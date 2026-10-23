import { Router } from "express";
import { parseReportController } from "../controllers/reportController.js";
import { analyzeExcelReportController } from "../controllers/analyzeExcelReportController.js";
import {
  createConversationController,
  listConversationsController,
} from "../controllers/conversationController.js";
import {
  deleteReportController,
  getReportController,
  listReportsController,
} from "../controllers/reportLibraryController.js";
import { reportUpload } from "../middleware/reportUpload.js";

const router = Router();

router.post("/reports/parse", parseReportController);

router.post(
  "/reports/analyze",
  reportUpload.single("report"),
  analyzeExcelReportController,
);

router.get("/reports", listReportsController);
router.get("/reports/:reportId", getReportController);
router.delete("/reports/:reportId", deleteReportController);

router.post(
  "/reports/:reportId/conversations",
  createConversationController,
);
router.get(
  "/reports/:reportId/conversations",
  listConversationsController,
);

export default router;

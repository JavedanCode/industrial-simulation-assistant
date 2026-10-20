import { Router } from "express";
import { parseReportController } from "../controllers/reportController.js";
import { analyzeExcelReportController } from "../controllers/analyzeExcelReportController.js";
import { reportUpload } from "../middleware/reportUpload.js";
import { reportUploadErrorHandler } from "../middleware/reportUploadErrorHandler.js";

const router = Router();

router.post("/reports/parse", parseReportController);

router.post(
  "/reports/analyze",
  reportUpload.single("report"),
  analyzeExcelReportController,
  reportUploadErrorHandler,
);

export default router;

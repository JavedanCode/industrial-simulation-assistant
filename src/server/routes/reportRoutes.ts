import { Router } from "express";
import { parseReportController } from "../controllers/reportController";

const router = Router();

router.post("/reports/parse", parseReportController);

export default router;

import { Router } from "express";
import { authenticate, authorize } from "@/middlewares/auth";
import {
  getSystemInfo,
  getSystemLogs,
  triggerSystemBackup,
} from "./system.controller";

const router = Router();

router.use(authenticate, authorize("ADMIN"));

router.get("/info", getSystemInfo);
router.post("/backup", triggerSystemBackup);
router.get("/logs", getSystemLogs);

export default router;

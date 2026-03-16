import { Router } from "express";
import { authenticate, authorize } from "@/middlewares/auth";
import { validate } from "@/middlewares/validate";
import {
  getAccessConfig,
  getBootstrapStatus,
  getThresholdConfig,
  getWhoDatasets,
  resetThresholdConfig,
  updateAccessConfig,
  updateThresholdConfig,
  updateWhoDataset,
} from "./settings.controller";
import {
  updateAccessConfigSchema,
  updateThresholdConfigSchema,
  updateWhoDatasetSchema,
} from "@/validations/master.validation";

const router = Router();

router.use(authenticate);

router.get("/threshold", authorize("ADMIN"), getThresholdConfig);
router.put(
  "/threshold",
  authorize("ADMIN"),
  validate(updateThresholdConfigSchema),
  updateThresholdConfig
);
router.post("/threshold/reset", authorize("ADMIN"), resetThresholdConfig);

router.get("/access", authorize("ADMIN"), getAccessConfig);
router.put(
  "/access",
  authorize("ADMIN"),
  validate(updateAccessConfigSchema),
  updateAccessConfig
);

router.get("/who-datasets", getWhoDatasets);
router.get("/bootstrap-status", authorize("ADMIN"), getBootstrapStatus);
router.put(
  "/who-datasets/:id",
  authorize("ADMIN"),
  validate(updateWhoDatasetSchema),
  updateWhoDataset
);

export default router;

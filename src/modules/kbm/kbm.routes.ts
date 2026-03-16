import { Router } from "express";
import { authenticate, authorize } from "@/middlewares/auth";
import { validate } from "@/middlewares/validate";
import { getKbmReferences, updateKbmReference } from "./kbm.controller";
import { updateKbmReferenceSchema } from "@/validations/master.validation";

const router = Router();

router.use(authenticate);

router.get("/", getKbmReferences);
router.put(
  "/:id",
  authorize("ADMIN"),
  validate(updateKbmReferenceSchema),
  updateKbmReference
);

export default router;

import express from "express";

import {
  predictMachineReading,
  predictMachineReadings,
} from "../controllers/machineModelController.js";
import {
  batchPredictionSchema,
  sensorReadingSchema,
} from "../validators/machineModelValidator.js";
import validate from "../../../utils/validate.js";

const router = express.Router();

// POST /api/public/machine-model/predict
router.post("/predict", validate(sensorReadingSchema), predictMachineReading);

// POST /api/public/machine-model/predict/batch
router.post("/predict/batch", validate(batchPredictionSchema), predictMachineReadings);

export default router;

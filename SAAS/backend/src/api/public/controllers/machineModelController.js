import { predictBatch, predictReading } from "../../../services/anomalyModelService.js";

export const predictMachineReading = async (req, res, next) => {
  try {
    const result = await predictReading(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const predictMachineReadings = async (req, res, next) => {
  try {
    const result = await predictBatch(req.body.readings);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

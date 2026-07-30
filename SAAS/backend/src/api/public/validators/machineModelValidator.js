import { z } from "zod";

export const sensorReadingSchema = z.object({
  voltage: z.number().finite(),
  current: z.number().finite(),
  temperature: z.number().finite(),
});

export const batchPredictionSchema = z.object({
  readings: z.array(sensorReadingSchema).min(1),
});

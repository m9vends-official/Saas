import { z } from "zod";

export const createDeviceSchema = z.object({
  device_id: z.string().min(1),
  machine_name: z.string().min(1),

  location: z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
  }),
});

export const updateDeviceSchema = z.object({
  status: z.enum([
    "REGISTERED",
    "ACTIVE",
    "MAINTENANCE",
    "DISABLED",
  ]),
});
import { z } from "zod";

export const inviteUserSchema = z.object({
  name:     z.string().min(1, "Name is required"),
  email:    z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  // BUG 3 FIX: Must match User model enum ["SUPER_ADMIN", "ADMIN", "TECHNICIAN"]
  // SUPER_ADMIN excluded here — cannot be created via invite for security reasons
  role:     z.enum(["ADMIN", "TECHNICIAN"]),
});

export const updateUserStatusSchema = z.object({
  is_active: z.boolean(),
});

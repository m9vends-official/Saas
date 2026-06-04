import { z } from "zod";

export const inviteUserSchema = z.object({
  name:     z.string().min(1, "Name is required"),
  email:    z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role:     z.enum(["ADMIN", "OPERATOR", "VIEWER"]),
});

export const updateUserStatusSchema = z.object({
  is_active: z.boolean(),
});

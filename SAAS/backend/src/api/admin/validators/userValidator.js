import { z } from "zod";

export const inviteUserSchema = z.object({
  name:       z.string().min(1, "Name is required"),
  email:      z.string().email("Invalid email"),
  password:   z.string().min(6, "Password must be at least 6 characters"),
  // SUPER_ADMIN excluded here - cannot be created via invite for security reasons
  role:       z.enum(["ADMIN", "TECHNICIAN"]),
  // Optional - only required when SUPER_ADMIN creates a user for a specific company
  company_id: z.string().optional(),
});

export const updateUserStatusSchema = z.object({
  is_active: z.boolean(),
});

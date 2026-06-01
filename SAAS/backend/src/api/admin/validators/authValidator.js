import { z } from "zod";
import ApiError from "../../../utils/ApiError.js";

// ─── Register Schema ───────────────────────────────────────────────────────────
const registerSchema = z.object({
  company_id: z.string().min(1, "company_id is required"),
  name:       z.string().min(2, "Name must be at least 2 characters"),
  email:      z.email("Invalid email address"),
  password:   z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "TECHNICIAN"], {
    error: "role must be one of: SUPER_ADMIN, ADMIN, TECHNICIAN",
  }),
});

// ─── Login Schema ──────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ─── Validator Middleware Factory ──────────────────────────────────────────────
// Returns an Express middleware that validates req.body against the given schema.
// On failure → passes a 400 ApiError to next() with a clear field-level message.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    // Flatten zod errors into a single readable string
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    return next(ApiError.badRequest(message));
  }

  // Replace req.body with the parsed (and stripped of unknown keys) data
  req.body = result.data;
  next();
};

// ─── Exported Validators ───────────────────────────────────────────────────────
export const validateRegister = validate(registerSchema);
export const validateLogin    = validate(loginSchema);

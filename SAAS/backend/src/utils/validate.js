import ApiError from "./ApiError.js";

// ─── Reusable Zod Validation Middleware ───────────────────────────────────────
// Takes any Zod schema and returns an Express middleware.
// Validates req.body — on failure passes a clean 400 to errorMiddleware.
//
// Usage:
//   import { validate } from "../../../utils/validate.js";
//   import { createDeviceSchema } from "../validators/deviceValidator.js";
//   router.post("/", validate(createDeviceSchema), createDevice);

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    return next(ApiError.badRequest(message));
  }

  // Replace req.body with Zod-parsed data (strips unknown fields)
  req.body = result.data;
  next();
};

export default validate;

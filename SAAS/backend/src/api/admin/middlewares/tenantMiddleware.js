import ApiError from "../../../utils/ApiError.js";

// ─── Tenant Middleware ────────────────────────────────────────────────────────
// Enforces company_id isolation on every admin route.
// Call AFTER authMiddleware — req.user must already be set.
//
// This is a safety net: it makes company_id available as req.company_id
// so controllers can ALWAYS use it without manually pulling from req.user.
//
// RULE: Every admin DB query MUST filter by req.company_id
// User.find({ company_id: req.company_id })
export const tenantMiddleware = (req, res, next) => {
  if (!req.user || !req.user.company_id) {
    return next(ApiError.unauthorized("Tenant context missing. Ensure you are authenticated."));
  }

  // Expose as top-level req property for convenience in controllers
  req.company_id = req.user.company_id;

  next();
};

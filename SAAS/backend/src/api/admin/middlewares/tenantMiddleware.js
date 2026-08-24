import ApiError from "../../../utils/ApiError.js";

// -------------------------------------------------------------
// Tenant Middleware
// Enforces company_id isolation on every admin route.
// Call AFTER authMiddleware — req.user must already be set.
//
// SUPER_ADMIN = Platform Admin ? can access ALL companies.
//   • No company_id forced — services must check role and
//     handle the case where req.company_id is null (global view).
//   • SUPER_ADMIN may optionally pass ?company_id= to scope
//     their request to a specific tenant.
//
// ADMIN / TECHNICIAN = Tenant-scoped ? locked to their own company_id.
// -------------------------------------------------------------
export const tenantMiddleware = (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized("Tenant context missing. Ensure you are authenticated."));
  }

  if (req.user.role === "SUPER_ADMIN") {
    // Super Admin can optionally narrow scope to a specific company
    // via ?company_id= query param; otherwise company_id stays null (global)
    req.company_id = req.query.company_id || null;
    req.is_super_admin = true;
  } else {
    // ADMIN and TECHNICIAN are always locked to their own company
    if (!req.user.company_id) {
      return next(ApiError.unauthorized("Tenant context missing. Ensure you are authenticated."));
    }
    req.company_id = req.user.company_id;
    req.is_super_admin = false;
  }

  next();
};

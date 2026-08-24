import Company from "../../../models/Company.js";
import User from "../../../models/User.js";
import ApiError from "../../../utils/ApiError.js";

// GET /api/admin/companies  (SUPER_ADMIN only)
export const listCompanies = async (req, res, next) => {
  try {
    if (!req.is_super_admin) {
      return next(ApiError.forbidden("Access denied"));
    }
    const companies = await Company.find().sort({ createdAt: -1 }).lean();
    // Count users per company
    const companiesWithCounts = await Promise.all(
      companies.map(async (c) => {
        const user_count = await User.countDocuments({ company_id: c._id });
        return { ...c, user_count };
      })
    );
    res.json({ success: true, data: companiesWithCounts });
  } catch (error) { next(error); }
};

// POST /api/admin/companies  (SUPER_ADMIN only — create a new client company)
export const createCompany = async (req, res, next) => {
  try {
    if (!req.is_super_admin) {
      return next(ApiError.forbidden("Access denied"));
    }
    const { company_name, plan, contact_email, contact_phone } = req.body;
    if (!company_name) return next(ApiError.badRequest("company_name is required"));
    const company = await Company.create({ company_name, plan, contact_email, contact_phone });
    res.status(201).json({ success: true, data: company });
  } catch (error) { next(error); }
};

// PATCH /api/admin/companies/:id  (SUPER_ADMIN only — toggle active, change plan)
export const updateCompany = async (req, res, next) => {
  try {
    if (!req.is_super_admin) {
      return next(ApiError.forbidden("Access denied"));
    }
    const { plan, is_active, contact_email, contact_phone } = req.body;
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { plan, is_active, contact_email, contact_phone },
      { new: true, runValidators: true }
    );
    if (!company) return next(ApiError.notFound("Company not found"));
    res.json({ success: true, data: company });
  } catch (error) { next(error); }
};

import {
  getSummary,
  getRevenueByMachine,
  getTopProducts,
  getRevenueOverTime,
  getPaymentMethodBreakdown,
  getRevenueByCompany,
} from "../../../services/analyticsService.js";

//  GET /api/admin/analytics/summary
export const summary = async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query;
    const data = await getSummary({ company_id: req.company_id, from_date, to_date });
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

//  GET /api/admin/analytics/revenue-by-machine
export const revenueByMachine = async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query;
    const data = await getRevenueByMachine({ company_id: req.company_id, from_date, to_date });
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

//  GET /api/admin/analytics/top-products
export const topProducts = async (req, res, next) => {
  try {
    const { from_date, to_date, limit } = req.query;
    const data = await getTopProducts({ company_id: req.company_id, from_date, to_date, limit });
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

//  GET /api/admin/analytics/revenue-over-time
export const revenueOverTime = async (req, res, next) => {
  try {
    const { from_date, to_date, group_by } = req.query;
    const data = await getRevenueOverTime({ company_id: req.company_id, from_date, to_date, group_by });
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

//  GET /api/admin/analytics/payment-methods
export const paymentMethods = async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query;
    const data = await getPaymentMethodBreakdown({ company_id: req.company_id, from_date, to_date });
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

//  GET /api/admin/analytics/revenue-by-company  (SUPER_ADMIN only)
export const revenueByCompany = async (req, res, next) => {
  try {
    if (!req.is_super_admin) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    const { from_date, to_date } = req.query;
    const data = await getRevenueByCompany({ from_date, to_date });
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

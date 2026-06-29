import {
  getSummary,
  getRevenueByMachine,
  getTopProducts,
  getRevenueOverTime,
  getPaymentMethodBreakdown,
} from "../../../services/analyticsService.js";

//  GET /api/admin/analytics/summary 
export const summary = async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query;

    const data = await getSummary({
      company_id: req.company_id,
      from_date,
      to_date,
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

//  GET /api/admin/analytics/revenue-by-machine 
export const revenueByMachine = async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query;

    const data = await getRevenueByMachine({
      company_id: req.company_id,
      from_date,
      to_date,
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

//  GET /api/admin/analytics/top-products 
export const topProducts = async (req, res, next) => {
  try {
    const { from_date, to_date, limit } = req.query;

    const data = await getTopProducts({
      company_id: req.company_id,
      from_date,
      to_date,
      limit,
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

//  GET /api/admin/analytics/revenue-over-time 
export const revenueOverTime = async (req, res, next) => {
  try {
    const { from_date, to_date, group_by } = req.query;

    const data = await getRevenueOverTime({
      company_id: req.company_id,
      from_date,
      to_date,
      group_by,   // "day" | "week" | "month"
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

//  GET /api/admin/analytics/payment-methods 
export const paymentMethods = async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query;

    const data = await getPaymentMethodBreakdown({
      company_id: req.company_id,
      from_date,
      to_date,
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

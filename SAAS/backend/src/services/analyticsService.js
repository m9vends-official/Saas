import Order from "../models/Order.js";
const buildDateFilter = (from_date, to_date) => {
  const filter = {};
  if (from_date || to_date) {
    filter.createdAt = {};
    if (from_date) filter.createdAt.$gte = new Date(from_date);
    if (to_date)   filter.createdAt.$lte = new Date(to_date + "T23:59:59.999Z");
  }
  return filter;
};
// 1. Summary 
// Total revenue, total orders, paid orders, pending orders, failed orders
export const getSummary = async ({ company_id, from_date, to_date }) => {
  const dateFilter = buildDateFilter(from_date, to_date);
  const result = await Order.aggregate([
    {
      $match: {
        company_id: new (await import("mongoose")).default.Types.ObjectId(company_id),
        ...dateFilter,
      },
    },
    {
      $group: {
        _id: null,
        total_orders:   { $sum: 1 },
        total_revenue:  { $sum: { $cond: [{ $eq: ["$payment_status", "PAID"] }, "$total_amount", 0] } },
        paid_orders:    { $sum: { $cond: [{ $eq: ["$payment_status", "PAID"] }, 1, 0] } },
        pending_orders: { $sum: { $cond: [{ $eq: ["$payment_status", "PENDING"] }, 1, 0] } },
        failed_orders:  { $sum: { $cond: [{ $eq: ["$payment_status", "FAILED"] }, 1, 0] } },
        cash_orders:    { $sum: { $cond: [{ $eq: ["$payment_method", "CASH"] }, 1, 0] } },
        upi_orders:     { $sum: { $cond: [{ $eq: ["$payment_method", "UPI"] }, 1, 0] } },
      },
    },
    {
      $project: {
        _id:            0,
        total_orders:   1,
        total_revenue:  1,
        paid_orders:    1,
        pending_orders: 1,
        failed_orders:  1,
        cash_orders:    1,
        upi_orders:     1,
        // Average order value (only paid orders)
        avg_order_value: {
          $cond: [
            { $gt: ["$paid_orders", 0] },
            { $divide: ["$total_revenue", "$paid_orders"] },
            0,
          ],
        },
      },
    },
  ]);
  // If no orders exist yet return zeros
  return result[0] ?? {
    total_orders:    0,
    total_revenue:   0,
    paid_orders:     0,
    pending_orders:  0,
    failed_orders:   0,
    cash_orders:     0,
    upi_orders:      0,
    avg_order_value: 0,
  };
};
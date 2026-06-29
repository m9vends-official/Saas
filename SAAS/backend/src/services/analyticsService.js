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

// 2. Revenue by Machine 
// Which vending machines earn the most

export const getRevenueByMachine = async ({company_id, from_date, to_date}) => {

  const mongoose = (await import("mongoose")).default;
  const dateFilter = buildDateFilter(from_date, to_date);

  return Order.aggregate([
    {
      $match: {
        company_id: new mongoose.Types.ObjectId(company_id),
        payment_status: "PAID",
        ...dateFilter,
      },
    },
    {
      $group: {
        _id: "$machine_id",
        total_revenue: {$sum: "total_amount"},
        total_orders: {$sum: 1},
        avg_order: {$avg: "$total_amount"},
      }
    },
    {
      $project: {
        _id: 0,
        machine_id: "$_id",
        total_revenue: 1,
        total_orders: 1,
        avg_order: {$round: ["$avg_order",2]},
      },
    },
    {$sort: {total_revenue: -1}},// Highest earning first
  ]);
};

// 3. Top Products
// Best selling products by quantity sold and revenue generated

export const getTopProducts = async ({company_id, from_date, to_date, limit = 10}) => {
  const mongoose = (await import("mongoose")).default;
  const dateFilter = buildDateFilter(from_date, to_date);

  return Order.aggregate([
    {
      $match: {
        company_id: new mongoose.Types.ObjectId(company_id),
        payment_status: "PAID",
        ...dateFilter
      }
    },
    // unwind items array - one doc per item
    {
      $group: {
        _id: "$items.product_id",
        product_name: {$first: "$items.product_name"},
        total_quantity: {$sum: "$items.quantity"},
        total_revenue: {$sum: "$items.subtotal"},
        times_ordered: {$sum:1},
      },
    },
    {
      $project: {
        _id: 0,
        product_id: "$_id",
        product_name: 1,
        total_quantity: 1,
        total_revenue: 1,
        times_ordered: 1,
      }
    },
    {$sort: {total_quantity: -1}},
    {$limit: parseInt(limit)},
  ]);
};

// 4. Revenue Over Time 
// Daily / weekly / monthly revenue chart data

export const getRevenueOverTime = async ({company_id, from_date, to_date, group_by = "day"}) => {
  const mongoose = (await import("mongoose")).default;
  const dateFilter = buildDateFilter(from_data, to_date);
  // build date grouping based on period
  const dateGroup = {
    day: {
      year: {$year: "$createdAt"},
      month: {$month: "$createdAt"},
      day: {$dayOfMonth: "$createdAt"},
    },
    week: {
      year: { $isoWeekYear: "$createdAt"},
      week: { $isoWeek: "$createdAt"}
    },
    month: {
      year: { $year: "$createdAt" },
      month: { $month: "$createdAt" }
    }
  }
  const sortStages = {
    day: {
      "period.year": 1,
      "period.month": 1,
      "period.day": 1,
    },
    week: {
      "period.year": 1,
      "period.week": 1,
    },
    month: {
      "period.year": 1,
      "period.month": 1,
    },
  };

  return Order.aggregate([
    {
      $match:{
        company_id: new mongoose.Types.ObjectId(company_id),
        payment_status: "PAID",
        ...dateFilter
      }
    },
    {
      $group: {
        _id: dateGroup[group_by] || dateGroup.day,
        revenue: {$sum : "$total_amount"},
        order_count: {$sum: 1},
      }
    },
    {
      $project: {
        _id: 0,
        period: "$_id",
        revenue: 1,
        order_count: 1,
      },
    },
    {$sort: sortStages[group_by] || sortStages.day},
  ])
}

// 5. Payment Method Breakdown 
// UPI vs CASH vs others — for reconciliation reports
export const getPaymentMethodBreakdown = async ({ company_id, from_date, to_date }) => {
  
  const mongoose = (await import("mongoose")).default;
  const dateFilter = buildDateFilter(from_date, to_date);

  return Order.aggregate([
    {
      $match: {
        company_id: new mongoose.Types.ObjectId(company_id),
        payment_status: "PAID",
        ...dateFilter,
      },
    },
    {
      $group: {
        _id:          "$payment_method",
        total_orders: { $sum: 1 },
        total_revenue: { $sum: "$total_amount" },
      },
    },
    {
      $project: {
        _id:           0,
        method:        "$_id",
        total_orders:  1,
        total_revenue: 1,
      },
    },
    { $sort: { total_revenue: -1 } },
  ]);
};


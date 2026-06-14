import {
  getTelemetryHistory,
  getLatestStatus,
  queryInfluxTelemetry,
} from "../../../services/telemetryService.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/telemetry/:device_id/history
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns the N most-recent telemetry documents for a device (from MongoDB).
 *
 * Query params:
 *   limit (number, default 100)  – max documents to return
 *   type  (string, optional)     – filter by event type (STATUS|SALE|STOCK|ALERT|HEARTBEAT)
 */
export const getHistory = async (req, res, next) => {
  try {
    const { device_id } = req.params;
    const company_id = req.company_id; // set by tenantMiddleware
    const limit = Math.min(parseInt(req.query.limit) || 100, 500); // cap at 500
    const type = req.query.type || null;

    const data = await getTelemetryHistory({ company_id, device_id, limit, type });

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/telemetry/:device_id/status
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns the latest STATUS event for a device.
 * Used by the admin dashboard to show online/offline, battery, temperature.
 */
export const getStatus = async (req, res, next) => {
  try {
    const { device_id } = req.params;
    const company_id = req.company_id;

    const status = await getLatestStatus(company_id, device_id);

    res.json({
      success: true,
      data: status || null,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/telemetry/:device_id/analytics
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns aggregated analytics from InfluxDB for a specific device.
 *
 * Query params:
 *   range   (string, default "24h")  – InfluxDB range string e.g. "1h", "7d", "30d"
 *   metric  (string, default "temperature") – which measurement field to aggregate
 *
 * Returns: mean value of the chosen metric over the selected time range,
 *          windowed into 1-hour buckets.
 *
 * Falls back to [] if InfluxDB is not configured.
 */
export const getAnalytics = async (req, res, next) => {
  try {
    const { device_id } = req.params;
    const company_id = req.company_id;
    const range  = req.query.range  || "24h";
    const metric = req.query.metric || "temperature";
    const bucket = process.env.INFLUXDB_BUCKET || "telemetry";

    // Validate range to prevent injection
    const validRanges = ["1h", "6h", "12h", "24h", "7d", "30d"];
    const safeRange   = validRanges.includes(range) ? range : "24h";

    // Validate metric to prevent injection
    const validMetrics = ["temperature", "battery", "price", "quantity_remaining", "uptime_seconds"];
    const safeMetric   = validMetrics.includes(metric) ? metric : "temperature";

    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: -${safeRange})
        |> filter(fn: (r) => r._measurement == "telemetry")
        |> filter(fn: (r) => r.device_id == "${device_id}")
        |> filter(fn: (r) => r.company_id == "${String(company_id)}")
        |> filter(fn: (r) => r._field == "${safeMetric}")
        |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
        |> yield(name: "mean")
    `;

    const rows = await queryInfluxTelemetry(fluxQuery);

    res.json({
      success: true,
      device_id,
      metric: safeMetric,
      range: safeRange,
      data: rows.map((r) => ({
        time:  r._time,
        value: r._value,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/telemetry/:device_id/sales-summary
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns total sales revenue and transaction count from InfluxDB.
 *
 * Query params:
 *   range (string, default "24h")
 */
export const getSalesSummary = async (req, res, next) => {
  try {
    const { device_id } = req.params;
    const company_id = req.company_id;
    const range  = req.query.range || "24h";
    const bucket = process.env.INFLUXDB_BUCKET || "telemetry";

    const validRanges = ["1h", "6h", "12h", "24h", "7d", "30d"];
    const safeRange   = validRanges.includes(range) ? range : "24h";

    // Sum total revenue
    const revenueQuery = `
      from(bucket: "${bucket}")
        |> range(start: -${safeRange})
        |> filter(fn: (r) => r._measurement == "telemetry")
        |> filter(fn: (r) => r.device_id == "${device_id}")
        |> filter(fn: (r) => r.company_id == "${String(company_id)}")
        |> filter(fn: (r) => r.type == "SALE")
        |> filter(fn: (r) => r._field == "price")
        |> sum()
        |> yield(name: "total_revenue")
    `;

    // Count transactions
    const countQuery = `
      from(bucket: "${bucket}")
        |> range(start: -${safeRange})
        |> filter(fn: (r) => r._measurement == "telemetry")
        |> filter(fn: (r) => r.device_id == "${device_id}")
        |> filter(fn: (r) => r.company_id == "${String(company_id)}")
        |> filter(fn: (r) => r.type == "SALE")
        |> filter(fn: (r) => r._field == "count")
        |> sum()
        |> yield(name: "transaction_count")
    `;

    const [revenueRows, countRows] = await Promise.all([
      queryInfluxTelemetry(revenueQuery),
      queryInfluxTelemetry(countQuery),
    ]);

    res.json({
      success: true,
      device_id,
      range: safeRange,
      data: {
        total_revenue:     revenueRows[0]?._value ?? 0,
        transaction_count: countRows[0]?._value   ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

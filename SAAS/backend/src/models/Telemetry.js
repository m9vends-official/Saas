import mongoose from "mongoose";

/**
 * Telemetry.js — MongoDB Time-Series Collection
 * ─────────────────────────────────────────────────────────────────────────
 * Stores ALL incoming MQTT messages from vending machines.
 *
 * Why timeseries? MongoDB time-series collections are physically optimised
 * for time-ordered data: smaller storage footprint, faster range queries,
 * and automatic bucketing — exactly what telemetry needs.
 *
 * Dual-storage strategy:
 *   • MongoDB  → stores the full JSON payload; used for REST queries
 *   • InfluxDB → stores numeric measurements; used for charts & analytics
 */

const TelemetrySchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    // The human-readable device ID (e.g. "VM-BPL-001")
    device_id: {
      type: String,
      required: true,
      index: true,
    },

    // What kind of event is this?
    type: {
      type: String,
      enum: ["STATUS", "SALE", "STOCK", "ALERT", "HEARTBEAT"],
      required: true,
    },

    // Flexible payload — different shape for each event type
    // STATUS  : { online, temperature, battery, firmware_version }
    // SALE    : { product_id, product_name, price, payment_method }
    // STOCK   : { slot_id, product_id, quantity_remaining }
    // ALERT   : { code, message, severity }
    // HEARTBEAT: { uptime_seconds }
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // The exact moment we received this message (used as time-series key)
    received_at: {
      type: Date,
      default: Date.now,
      index: true, // for time-range queries
    },
  },
  {
    // ── MongoDB Time-Series Collection ─────────────────────────────────
    // Tells MongoDB to organise data internally by time.
    // timeField  : the field that acts as the timestamp
    // metaField  : the main "grouping" key (device_id is perfect here)
    // granularity: how frequently we expect data — 'seconds' is right for IoT
    timeseries: {
      timeField: "received_at",
      metaField: "device_id",
      granularity: "seconds",
    },
  }
);

// ── TTL: Auto-delete documents older than 30 days ────────────────────────
// Prevents the collection from growing unbounded.
// InfluxDB holds the long-term analytics data; MongoDB only needs recent records.
TelemetrySchema.index({ received_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.model("Telemetry", TelemetrySchema);

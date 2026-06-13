import { Point } from "@influxdata/influxdb-client";
import Telemetry from "../models/Telemetry.js";
import Device from "../models/Device.js";
import { getInfluxWriteApi } from "../config/influxdb.js";
import logger from "../utils/logger.js";

// ─────────────────────────────────────────────────────────────────────────────
// WRITE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * saveTelemetry()
 * ─────────────────────────────────────────────────────────────────────────
 * Dual-writes an incoming MQTT message:
 *   1. MongoDB  — full JSON doc (used by REST history endpoints)
 *   2. InfluxDB — numeric fields only (used by analytics/charting)
 *
 * @param {Object} params
 * @param {string} params.company_id  MongoDB ObjectId string
 * @param {string} params.device_id   e.g. "VM-BPL-001"
 * @param {string} params.type        "STATUS" | "SALE" | "STOCK" | "ALERT" | "HEARTBEAT"
 * @param {Object} params.payload     The parsed MQTT JSON payload
 * @returns {Promise<Object>}         The saved MongoDB document
 */
export async function saveTelemetry({ company_id, device_id, type, payload }) {
  // ── 1. Write to MongoDB ────────────────────────────────────────────────
  const doc = await Telemetry.create({ company_id, device_id, type, payload });
  logger.info({ device_id, type }, "Telemetry saved to MongoDB");

  // ── 2. Write numeric fields to InfluxDB ───────────────────────────────
  _writeToInflux({ company_id, device_id, type, payload, timestamp: doc.received_at });

  return doc;
}

/**
 * _writeToInflux() — private helper
 * Maps each telemetry type to an InfluxDB Point with relevant numeric fields.
 * If InfluxDB is not configured, this is a no-op.
 */
function _writeToInflux({ company_id, device_id, type, payload, timestamp }) {
  const writeApi = getInfluxWriteApi();
  if (!writeApi) return; // InfluxDB not configured — skip silently

  try {
    let point = new Point("telemetry")
      .tag("company_id", String(company_id))
      .tag("device_id", device_id)
      .tag("type", type)
      .timestamp(timestamp);

    // Add numeric fields depending on the event type
    switch (type) {
      case "STATUS":
        if (typeof payload.temperature === "number")
          point.floatField("temperature", payload.temperature);
        if (typeof payload.battery === "number")
          point.intField("battery", payload.battery);
        point.booleanField("online", payload.online ?? true);
        break;

      case "SALE":
        if (typeof payload.price === "number")
          point.floatField("price", payload.price);
        if (payload.payment_method)
          point.tag("payment_method", payload.payment_method);
        if (payload.product_id)
          point.tag("product_id", payload.product_id);
        point.intField("count", 1); // every SALE = 1 transaction
        break;

      case "STOCK":
        if (typeof payload.quantity_remaining === "number")
          point.intField("quantity_remaining", payload.quantity_remaining);
        if (payload.slot_id)
          point.tag("slot_id", String(payload.slot_id));
        break;

      case "ALERT":
        if (payload.code) point.tag("alert_code", String(payload.code));
        if (payload.severity) point.tag("severity", payload.severity);
        point.intField("count", 1);
        break;

      case "HEARTBEAT":
        if (typeof payload.uptime_seconds === "number")
          point.intField("uptime_seconds", payload.uptime_seconds);
        point.intField("count", 1);
        break;

      default:
        // Unknown type — write a generic count so it still shows in InfluxDB
        point.intField("count", 1);
    }

    writeApi.writePoint(point);
    logger.debug({ device_id, type }, "Telemetry point queued to InfluxDB");
  } catch (err) {
    // Never crash the server because of an InfluxDB write error
    logger.error({ err, device_id, type }, " InfluxDB write failed (non-fatal)");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ HELPERS  (MongoDB — used by REST endpoints)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getTelemetryHistory()
 * Returns the most recent N telemetry documents for a device.
 * Optionally filter by event type.
 */
export async function getTelemetryHistory({
  company_id,
  device_id,
  limit = 100,
  type = null,
}) {
  const filter = { company_id, device_id };
  if (type) filter.type = type.toUpperCase();

  return Telemetry.find(filter)
    .sort({ received_at: -1 })
    .limit(limit)
    .lean();
}

/**
 * getLatestStatus()
 * Returns the single most-recent STATUS event for a device.
 * Used by the admin dashboard "machine status" card.
 */
export async function getLatestStatus(company_id, device_id) {
  return Telemetry.findOne({ company_id, device_id, type: "STATUS" })
    .sort({ received_at: -1 })
    .lean();
}

/**
 * updateDeviceStatus()
 * Stamps the Device document with online/offline state and last_seen_at.
 * Called by mqttService whenever a STATUS message arrives.
 */
export async function updateDeviceStatus(company_id, device_id, online) {
  try {
    await Device.findOneAndUpdate(
      { company_id, device_id },
      {
        status: online ? "ACTIVE" : "OFFLINE",
        last_seen_at: new Date(),
      }
    );
    logger.debug({ device_id, online }, "Device status updated");
  } catch (err) {
    // Non-fatal — log but don't crash the MQTT handler
    logger.error({ err, device_id }, "Failed to update device status");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INFLUXDB QUERY HELPERS  (used by analytics endpoints)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * queryInfluxTelemetry()
 * Runs a raw Flux query against InfluxDB and returns rows as plain objects.
 *
 * @param {string} fluxQuery  A valid Flux query string
 * @returns {Promise<Array>}  Array of result row objects
 */
export async function queryInfluxTelemetry(fluxQuery) {
  const { getInfluxQueryApi } = await import("../config/influxdb.js");
  const queryApi = getInfluxQueryApi();
  if (!queryApi) return [];

  const rows = [];
  return new Promise((resolve, reject) => {
    queryApi.queryRows(fluxQuery, {
      next(row, tableMeta) {
        rows.push(tableMeta.toObject(row));
      },
      error(err) {
        logger.error({ err }, "InfluxDB query error");
        reject(err);
      },
      complete() {
        resolve(rows);
      },
    });
  });
}

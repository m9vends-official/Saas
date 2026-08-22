import mqtt from "mqtt";
import logger from "../utils/logger.js";

// ─── Telemetry Cache ──────────────────────────────────────────────────────────
// In-memory store of the latest telemetry snapshot per machine.
// Shape: Map<machine_id, { data: Object, updatedAt: Date }>
export const telemetryCache = new Map();

// ─── Socket.IO Reference ──────────────────────────────────────────────────────
// Set via initMqttService(io) so this module can emit to company rooms.
let _io = null;

// ─── Alert Severity Classifier ───────────────────────────────────────────────
// Maps known IoT alert strings to severity levels.
// All unknown strings default to "WARNING".
const classifyAlert = (text) => {
  const upper = text.toUpperCase();
  if (upper.includes("ANOMALY"))               return "CRITICAL";
  if (upper.includes("NOT CONNECTED"))         return "HIGH";
  if (upper.includes("DOOR OPEN"))             return "HIGH";
  if (upper.includes("DISPENSE FAIL"))         return "HIGH";
  if (upper.includes("LOW STOCK"))             return "WARNING";
  if (upper.includes("OFFLINE"))               return "WARNING";
  return "INFO";
};

// ─── Company Lookup ───────────────────────────────────────────────────────────
// Fetches the company_id that owns a given machine_id.
// We look it up from the Order model (which always has company_id + machine_id),
// because the SaaS backend has no separate Machine model —
// the IoT backend owns the device record.
//
// Lazy import to avoid circular deps at module load time.
const getCompanyForMachine = async (machine_id) => {
  const { default: Order } = await import("../models/Order.js");
  const order = await Order.findOne({ machine_id }).select("company_id").lean();
  return order?.company_id?.toString() ?? null;
};

// ─── MQTT Service Initializer ─────────────────────────────────────────────────
export const initMqttService = (io) => {
  _io = io;

  const brokerUrl = `mqtt://${process.env.MQTT_BROKER_HOST}:${process.env.MQTT_BROKER_TCP_PORT}`;

  const client = mqtt.connect(brokerUrl, {
    username:  process.env.MQTT_ADMIN_USERNAME,
    password:  process.env.MQTT_ADMIN_PASSWORD,
    clientId:  `saas-backend-${Date.now()}`,
    clean:     true,
    reconnectPeriod: 5000,   // retry every 5 s on disconnect
  });

  // ── Connection Events ───────────────────────────────────────────────────────
  client.on("connect", () => {
    logger.info("[MQTT] Connected to broker");

    // Subscribe to telemetry and status for ALL devices (wildcard +)
    client.subscribe(["device/+/telemetry", "device/+/status"], { qos: 1 }, (err) => {
      if (err) {
        logger.error("[MQTT] Subscription failed:", err.message);
      } else {
        logger.info("[MQTT] Subscribed → device/+/telemetry, device/+/status");
      }
    });
  });

  client.on("error",      (err) => logger.error("[MQTT] Error:", err.message));
  client.on("offline",    ()    => logger.warn("[MQTT] Client offline — reconnecting..."));
  client.on("reconnect",  ()    => logger.info("[MQTT] Reconnecting..."));

  // ── Message Handler ─────────────────────────────────────────────────────────
  client.on("message", async (topic, buffer) => {
    try {
      // Extract machine_id from topic: "device/<machine_id>/telemetry"
      const parts     = topic.split("/");
      const machine_id = parts[1];
      const topicType  = parts[2]; // "telemetry" | "status"
      const raw        = buffer.toString();
      
      // ── Status events (device online/offline) ─────────────────────────────
      if (topicType === "status") {
        const company_id = await getCompanyForMachine(machine_id);
        if (company_id && _io) {
          _io.to(company_id).emit("machine:status", {
            machine_id,
            status: raw.trim(), // "online" | "offline"
            timestamp: new Date().toISOString(),
          });
        }
        return;
      }

      // ── Telemetry events ──────────────────────────────────────────────────
      // Two payload formats arrive on device/+/telemetry:
      //   1. JSON  → normal sensor data  e.g. { "Steering Motor Temperature": 28, ... }
      //   2. Text  → alert string        e.g. "Anomaly Detected"
      let parsed = null;
      let isAlert = false;

      try {
        parsed  = JSON.parse(raw);
        isAlert = false;
      } catch {
        // Not valid JSON → it's an alert string
        parsed  = raw.trim();
        isAlert = true;
      }

      const company_id = await getCompanyForMachine(machine_id);

      if (!company_id) {
        // Machine not yet linked to any company order — skip silently
        return;
      }

      if (isAlert) {
        // ── Alert path ──────────────────────────────────────────────────────
        const severity = classifyAlert(parsed);
        const alertPayload = {
          machine_id,
          message:   parsed,
          severity,
          timestamp: new Date().toISOString(),
        };

        if (_io) {
          _io.to(company_id).emit("machine:alert", alertPayload);
          logger.info(`[MQTT] Alert → company ${company_id} | machine ${machine_id} | ${severity}: ${parsed}`);
        }
      } else {
        // ── Normal telemetry path ───────────────────────────────────────────
        telemetryCache.set(machine_id, { data: parsed, updatedAt: new Date() });

        if (_io) {
          _io.to(company_id).emit("machine:telemetry", {
            machine_id,
            data:      parsed,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      // Never crash the MQTT service on a bad message
      logger.error("[MQTT] Message handler error:", err.message);
    }
  });

  return client;
};

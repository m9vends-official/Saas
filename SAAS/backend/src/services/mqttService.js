import { getMQTTClient } from "../config/mqtt.js";
import {
  saveTelemetry,
  updateDeviceStatus,
} from "./telemetryService.js";
import logger from "../utils/logger.js";

// ─────────────────────────────────────────────────────────────────────────────
// Topic structure:  devices/{company_id}/{device_id}/{type}
//   Example:        devices/663a1f.../VM-BPL-001/STATUS
//
// Wildcards:
//   +   matches exactly ONE level (single word between slashes)
//   #   matches everything from that point to the end
//
// We use 'devices/+/+/#' so we catch every message under 'devices/'
// but SKIP internal broker topics like '$SYS/...'
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_PATTERN = "devices/+/+/#";

/**
 * startMQTTSubscriptions(io)
 * ─────────────────────────────────────────────────────────────────────────
 * Subscribes to all device topics and wires up the message handler.
 * Must be called AFTER connectMQTT() and AFTER Socket.io is ready.
 *
 * @param {import('socket.io').Server} io  The Socket.io server instance
 */
export function startMQTTSubscriptions(io) {
  const client = getMQTTClient();

  // ── Subscribe ────────────────────────────────────────────────────────────
  client.subscribe(TOPIC_PATTERN, { qos: 1 }, (err) => {
    if (err) {
      logger.error({ err }, "Failed to subscribe to MQTT topics");
    } else {
      logger.info(`MQTT subscribed → ${TOPIC_PATTERN}`);
    }
  });

  // ── Message Handler ───────────────────────────────────────────────────────
  client.on("message", async (topic, messageBuffer) => {
    // ── 1. Parse topic ──────────────────────────────────────────────────
    const parts = topic.split("/");
    if (parts.length < 4 || parts[0] !== "devices") {
      // Ignore anything that doesn't match our expected structure
      return;
    }

    const [, company_id, device_id, type] = parts;
    const telemetryType = type.toUpperCase();

    // ── 2. Parse payload (always wrap in try/catch!) ────────────────────
    let payload;
    try {
      payload = JSON.parse(messageBuffer.toString());
    } catch (parseErr) {
      // A malformed JSON message must NEVER crash the server.
      logger.warn(
        { topic, raw: messageBuffer.toString().slice(0, 200) },
        "MQTT message has invalid JSON — ignored"
      );
      return;
    }

    logger.debug({ topic, device_id, telemetryType }, "📨 MQTT message received");

    // ── 3. Persist (MongoDB + InfluxDB) ─────────────────────────────────
    let saved;
    try {
      saved = await saveTelemetry({
        company_id,
        device_id,
        type: telemetryType,
        payload,
      });
    } catch (dbErr) {
      logger.error({ dbErr, topic }, "Failed to save telemetry");
      return; // stop processing — don't emit partial data
    }

    // ── 4. Update Device online/offline status ───────────────────────────
    if (telemetryType === "STATUS") {
      await updateDeviceStatus(company_id, device_id, payload.online ?? true);
    }

    // ── 5. Push real-time update to browser (Socket.io) ─────────────────
    // Emit ONLY to the Socket.io room for this company.
    // This is the multi-tenant isolation: Company A never sees Company B's data.
    if (io) {
      io.to(`company:${company_id}`).emit("telemetry", {
        device_id,
        type: telemetryType,
        payload,
        received_at: saved.received_at,
      });
    }
  });
}

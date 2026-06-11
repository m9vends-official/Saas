import mqtt from "mqtt";
import logger from "../utils/logger.js";

// ─── Module-level singleton ────────────────────────────────────────────────
// We only ever want ONE connection to the broker. Any file that needs
// to publish a message imports getMQTTClient() instead of creating its own.
let client = null;

/**
 * connectMQTT()
 * ─────────────────────────────────────────────────────────────────────────
 * Opens a persistent connection to the Mosquitto broker.
 * Call this ONCE from server.js, after the DB connects.
 *
 * The client automatically reconnects if the broker goes offline
 * (reconnectPeriod: 5000ms). Your server never crashes on broker restarts.
 */
export function connectMQTT() {
  // Read from .env — defaults to localhost Docker container
  const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";

  client = mqtt.connect(brokerUrl, {
    // Unique ID so the broker can identify this specific server instance
    clientId: `m9vends-server-${Date.now()}`,

    // clean: true — don't resume a previous session (fresh start each time)
    clean: true,

    // If the broker goes down, retry every 5 seconds automatically
    reconnectPeriod: 5000,

    // Give up on a single connect attempt after 30 seconds
    connectTimeout: 30_000,
  });

  // ── Event: Successfully connected ────────────────────────────────────────
  client.on("connect", () => {
    logger.info("MQTT Broker connected");
  });

  // ── Event: Connection error ───────────────────────────────────────────────
  // Logged but NOT thrown — the reconnect logic handles recovery automatically
  client.on("error", (err) => {
    logger.error({ err }, "MQTT connection error");
  });

  // ── Event: Auto-reconnect attempt ────────────────────────────────────────
  client.on("reconnect", () => {
    logger.warn(" MQTT reconnecting...");
  });

  // ── Event: Connection closed ──────────────────────────────────────────────
  client.on("close", () => {
    logger.warn(" MQTT connection closed");
  });

  // ── Event: Broker unreachable ─────────────────────────────────────────────
  client.on("offline", () => {
    logger.warn(" MQTT client offline");
  });

  return client;
}

/**
 * getMQTTClient()
 * ─────────────────────────────────────────────────────────────────────────
 * Returns the shared client instance.
 * Throws a clear error if called before connectMQTT().
 */
export function getMQTTClient() {
  if (!client) {
    throw new Error("MQTT not initialized. Call connectMQTT() first in server.js");
  }
  return client;
}

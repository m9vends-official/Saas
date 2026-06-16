import { InfluxDB } from "@influxdata/influxdb-client";
import logger from "../utils/logger.js";

// ─── Module-level singletons ────────────────────────────────────────────────
// One InfluxDB client shared across the whole process.
// writeApi is the object you call .writePoint() on.
let influxClient = null;
let writeApi = null;
let queryApi = null;

/**
 * connectInfluxDB()
 * ─────────────────────────────────────────────────────────────────────────
 * Creates the InfluxDB client and opens a write API.
 * Call this ONCE from server.js, after the DB connects.
 *
 * Required .env variables:
 *   INFLUXDB_URL      – e.g. http://localhost:8086
 *   INFLUXDB_TOKEN    – admin token from InfluxDB UI
 *   INFLUXDB_ORG      – your organisation name
 *   INFLUXDB_BUCKET   – bucket to write telemetry into
 */
export function connectInfluxDB() {
  const url    = process.env.INFLUXDB_URL    || "http://localhost:8086";
  const token  = process.env.INFLUXDB_TOKEN  || "";
  const org    = process.env.INFLUXDB_ORG    || "m9vends";
  const bucket = process.env.INFLUXDB_BUCKET || "telemetry";

  if (!token) {
    logger.warn(
      "⚠️  INFLUXDB_TOKEN is not set — InfluxDB writes will be disabled. " +
      "Set the token in .env to enable time-series storage."
    );
    return null;
  }

  try {
    influxClient = new InfluxDB({ url, token });

    // writeApi: batches writes, auto-flushes every 1 second (batchSize 1000 or 1s)
    writeApi = influxClient.getWriteApi(org, bucket, "ms", {
      batchSize: 1000,
      flushInterval: 1000,   // flush at least every 1 second
      maxRetries: 3,
    });

    // queryApi: used for reading data back
    queryApi = influxClient.getQueryApi(org);

    logger.info(`✅ InfluxDB connected → ${url} | org: ${org} | bucket: ${bucket}`);
    return { writeApi, queryApi };
  } catch (err) {
    logger.error({ err }, "❌ InfluxDB connection failed");
    return null;
  }
}

/**
 * getWriteApi()
 * Returns the write API — call .writePoint() on this.
 * Returns null if InfluxDB was not configured (token missing).
 */
export function getInfluxWriteApi() {
  return writeApi;
}

/**
 * getQueryApi()
 * Returns the query API — use for Flux queries.
 * Returns null if InfluxDB was not configured.
 */
export function getInfluxQueryApi() {
  return queryApi;
}

/**
 * closeInfluxDB()
 * Gracefully flush remaining buffered points on shutdown.
 */
export async function closeInfluxDB() {
  if (writeApi) {
    try {
      await writeApi.close();
      logger.info("InfluxDB write API closed gracefully");
    } catch (err) {
      logger.error({ err }, "Error closing InfluxDB write API");
    }
  }
}

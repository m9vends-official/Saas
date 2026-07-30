import ApiError from "../utils/ApiError.js";

const DEFAULT_MODEL_API_URL = "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 5000;

const getBaseUrl = () =>
  (process.env.ML_MODEL_API_URL || DEFAULT_MODEL_API_URL).replace(/\/+$/, "");

const getTimeoutMs = () => {
  const timeout = Number.parseInt(process.env.ML_MODEL_TIMEOUT_MS || "", 10);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS;
};

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const upstreamMessage = (payload, fallback) => {
  if (!payload) return fallback;
  if (typeof payload.detail === "string") return payload.detail;
  if (typeof payload.message === "string") return payload.message;
  return fallback;
};

const mapUpstreamStatus = (statusCode) => {
  if (statusCode === 400 || statusCode === 422) return 422;
  if (statusCode === 404) return 502;
  if (statusCode === 503) return 503;
  if (statusCode >= 500) return 502;
  return statusCode;
};

const requestModelApi = async (path, { method = "GET", body } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());
  const url = `${getBaseUrl()}${path}`;

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await parseJson(response);

    if (!response.ok) {
      throw new ApiError(
        mapUpstreamStatus(response.status),
        upstreamMessage(payload, "Machine model service returned an error"),
        payload ? [payload] : []
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error.name === "AbortError") {
      throw new ApiError(504, "Machine model service timed out");
    }

    throw new ApiError(503, "Machine model service is unavailable", [
      { url, cause: error.message },
    ]);
  } finally {
    clearTimeout(timeout);
  }
};

export const getModelHealth = () => requestModelApi("/health");

export const getModelInfo = () => requestModelApi("/model/info");

export const trainModel = () =>
  requestModelApi("/model/train", { method: "POST" });

export const reloadModel = () =>
  requestModelApi("/model/reload", { method: "POST" });

export const resetModelState = () =>
  requestModelApi("/model/reset-state", { method: "POST" });

export const predictReading = (reading) =>
  requestModelApi("/predict", { method: "POST", body: reading });

export const predictBatch = (readings) =>
  requestModelApi("/predict/batch", {
    method: "POST",
    body: { readings },
  });

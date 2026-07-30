import ApiError from "../utils/ApiError.js";

const DEFAULT_SECURITY_MODEL_API_URL = "http://localhost:8001";
const DEFAULT_TIMEOUT_MS = 120000;

const getBaseUrl = () =>
  (process.env.SECURITY_MODEL_API_URL || DEFAULT_SECURITY_MODEL_API_URL).replace(
    /\/+$/,
    ""
  );

const getTimeoutMs = () => {
  const timeout = Number.parseInt(process.env.SECURITY_MODEL_TIMEOUT_MS || "", 10);
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

const requestSecurityModelApi = async (
  path,
  { method = "GET", body, headers } = {}
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());
  const url = `${getBaseUrl()}${path}`;

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers,
      body,
    });

    const payload = await parseJson(response);

    if (!response.ok) {
      throw new ApiError(
        mapUpstreamStatus(response.status),
        upstreamMessage(payload, "Security model service returned an error"),
        payload ? [payload] : []
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error.name === "AbortError") {
      throw new ApiError(504, "Security model service timed out");
    }

    throw new ApiError(503, "Security model service is unavailable", [
      { url, cause: error.message },
    ]);
  } finally {
    clearTimeout(timeout);
  }
};

export const getSecurityModelHealth = () => requestSecurityModelApi("/health");

export const getLatestSecurityAnalysis = () => requestSecurityModelApi("/latest");

export const analyzeSecurityFrame = ({ body, contentType }) => {
  if (!contentType?.toLowerCase().startsWith("multipart/form-data")) {
    throw ApiError.badRequest("Content-Type must be multipart/form-data");
  }

  if (!body || body.length === 0) {
    throw ApiError.badRequest("Image file is required");
  }

  return requestSecurityModelApi("/analyze", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });
};


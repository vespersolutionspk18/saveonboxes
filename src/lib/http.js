import { getRequestOrigin, normalizeAppOrigin } from "./app-origin.js";

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return Response.json(data, { ...init, headers });
}

export function fail(message, status = 400, code = "bad_request") {
  return json({ error: { message, code } }, { status });
}

export async function readJson(request, maximumBytes = 64 * 1024) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maximumBytes) throw Object.assign(new Error("Request body is too large"), { status: 413 });
  try {
    const data = await request.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Expected a JSON object");
    return data;
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(new Error("Invalid JSON request body"), { status: 400 });
  }
}

export function checkSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const parsedOrigin = new URL(origin);
    const suppliedOrigin = normalizeAppOrigin(origin);
    if (!suppliedOrigin || parsedOrigin.origin !== origin) {
      return fail("Request origin is not allowed", 403, "origin_denied");
    }
    const requestOrigin = getRequestOrigin(request);
    if (!requestOrigin) return fail("Request origin is not allowed", 403, "origin_denied");
    const configuredOrigin = normalizeAppOrigin(process.env.APP_ORIGIN);
    const allowedOrigins = new Set([requestOrigin, configuredOrigin].filter(Boolean));
    if (!allowedOrigins.has(suppliedOrigin)) return fail("Request origin is not allowed", 403, "origin_denied");
  } catch {
    return fail("Request origin is not allowed", 403, "origin_denied");
  }
  return null;
}

export function clientAddress(request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  return address.slice(0, 128);
}

export function errorResponse(error) {
  if (error?.status) return fail(error.message, error.status, error.code || "request_error");
  if (error?.code === "23505") return fail("That value is already in use", 409, "conflict");
  if (error?.code === "23503" || error?.code === "22P02") return fail("The requested record is invalid", 400, "invalid_reference");
  return fail("The request could not be completed", 500, "internal_error");
}

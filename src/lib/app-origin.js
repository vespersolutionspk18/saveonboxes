const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeAppOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (!ALLOWED_PROTOCOLS.has(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveAppOrigin({ configuredOrigin, requestOrigin } = {}) {
  if (typeof configuredOrigin === "string" && configuredOrigin.trim()) {
    return normalizeAppOrigin(configuredOrigin);
  }
  return normalizeAppOrigin(requestOrigin);
}

export function getRequestOrigin(request) {
  try {
    const requestUrl = new URL(request.url);
    if (!ALLOWED_PROTOCOLS.has(requestUrl.protocol)) return null;
    const host = request.headers.get("host");
    if (host === null || host === "") return normalizeAppOrigin(requestUrl.origin);
    if (host !== host.trim() || /[\s/@?#\\,]/.test(host)) return null;
    const parsed = new URL(`${requestUrl.protocol}//${host}`);
    if (parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) return null;
    return normalizeAppOrigin(parsed.origin);
  } catch {
    return null;
  }
}

export function buildLabelUrl(token, origin) {
  const normalizedOrigin = normalizeAppOrigin(origin);
  if (!normalizedOrigin) throw new Error("Application origin is not configured or invalid");
  if (typeof token !== "string" || !token || !/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error("QR token is invalid");
  }
  return new URL(`/q/${token}`, normalizedOrigin).toString();
}

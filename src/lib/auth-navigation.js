export function safeNextPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u0020\u007f]/.test(value)) return "/dashboard";
  try {
    const url = new URL(value, "https://boxsave.invalid");
    if (url.origin !== "https://boxsave.invalid") return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}

export function safeQrContinuation(value) {
  if (typeof value !== "string" || value.length > 512) return null;
  const path = safeNextPath(value);
  const url = new URL(path, "https://boxsave.invalid");
  const tokenMatch = url.pathname.match(/^\/q\/([A-Za-z0-9_-]{24,64})$/);
  const queryKeys = [...url.searchParams.keys()];
  const scanSource = url.searchParams.get("source");
  if (!tokenMatch || url.hash || (queryKeys.length && (queryKeys.length !== 1 || queryKeys[0] !== "source" || !["url", "camera"].includes(scanSource)))) return null;
  return `/q/${tokenMatch[1]}${scanSource ? `?source=${scanSource}` : ""}`;
}

export function safeRecoveryContinuation(value) {
  if (typeof value !== "string" || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u0020\u007f]/.test(value)) return null;
  const path = safeNextPath(value);
  const url = new URL(path, "https://boxsave.invalid");
  if (url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")) return path;
  return safeQrContinuation(path);
}

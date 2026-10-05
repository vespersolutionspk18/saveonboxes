import { safeNextPath, safeQrContinuation } from "../../../lib/auth-navigation.js";

export { safeNextPath };

export async function api(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* Some successful endpoints have no body. */ }
  if (!response.ok) {
    const message = payload.message || payload.error?.message || (typeof payload.error === "string" ? payload.error : null) || (response.status === 401 ? "Please log in to continue." : "Something went wrong. Please try again.");
    const error = new Error(typeof message === "string" ? message : "Something went wrong. Please try again.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function signInDestination(user, requestedNext) {
  const nextPath = safeNextPath(requestedNext);
  const nextUrl = new URL(nextPath, "https://boxsave.invalid");
  const qrContinuation = safeQrContinuation(requestedNext);
  if (qrContinuation) return qrContinuation;
  if (user?.role === "super_admin") return "/admin";
  // Continue a customer's box or scan flow, while keeping login and admin
  // destinations out of customer redirects, including old bookmarked links.
  const pathname = nextUrl.pathname;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return nextPath;
  return "/dashboard";
}

export function boxNumber(box) {
  const number = box?.boxNumber ?? box?.number;
  return number == null ? "—" : `Box ${number}`;
}

export function itemCount(box) {
  return (box?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
}

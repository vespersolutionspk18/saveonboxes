import { safeNextPath, safeQrContinuation } from "../../../lib/auth-navigation.js";

export { safeNextPath };

export async function api(path, options = {}) {
  const { timeoutMs = 30_000, signal: callerSignal, ...requestOptions } = options;
  const isFormData = typeof FormData !== "undefined" && requestOptions.body instanceof FormData;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const abortFromCaller = () => controller.abort(callerSignal.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...requestOptions,
      signal: controller.signal,
      headers: { ...(requestOptions.body && !isFormData ? { "Content-Type": "application/json" } : {}), ...requestOptions.headers },
    });
    let payload = {};
    try { payload = await response.json(); }
    catch (error) { if (controller.signal.aborted) throw error; /* Some successful endpoints have no body. */ }
    if (!response.ok) {
      const message = payload.message || payload.error?.message || (typeof payload.error === "string" ? payload.error : null) || (response.status === 401 ? "Please log in to continue." : "Something went wrong. Please try again.");
      const error = new Error(typeof message === "string" ? message : "Something went wrong. Please try again.");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error("This request took too long. Please check the box before trying again.");
      timeoutError.code = "ETIMEDOUT";
      timeoutError.timedOut = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
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

export function defaultBoxName(box) {
  const defaultName = typeof box?.defaultName === "string" ? box.defaultName.trim() : "";
  const labelSerial = typeof box?.labelSerial === "string" ? box.labelSerial.trim() : "";
  return defaultName || labelSerial || boxNumber(box);
}

export function boxDisplayName(box) {
  const name = typeof box?.name === "string" ? box.name.trim() : "";
  const labelSerial = typeof box?.labelSerial === "string" ? box.labelSerial.trim() : "";
  // Older boxes saved their generated "Box N" fallback as if it were a
  // custom name. When a QR serial exists, keep the sticker's printed name.
  if (labelSerial && name === boxNumber(box)) return labelSerial;
  return name || defaultBoxName(box);
}

export function boxStickerSerial(box) {
  const labelSerial = typeof box?.labelSerial === "string" ? box.labelSerial.trim() : "";
  return labelSerial && labelSerial !== boxDisplayName(box) ? labelSerial : "";
}

export function itemCount(box) {
  return (box?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
}

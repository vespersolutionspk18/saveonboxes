export async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
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

export function signInDestination(user, requestedNext) {
  if (user?.role === "super_admin") return "/admin";
  const nextPath = safeNextPath(requestedNext);
  // Continue a customer's box or scan flow, while keeping login and admin
  // destinations out of customer redirects, including old bookmarked links.
  const pathname = new URL(nextPath, "https://boxsave.invalid").pathname;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname.startsWith("/q/")) return nextPath;
  return "/dashboard";
}

export function boxNumber(box) {
  const number = box?.boxNumber ?? box?.number;
  return number == null ? "—" : `Box ${number}`;
}

export function itemCount(box) {
  return (box?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
}

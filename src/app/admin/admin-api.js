export async function adminRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    credentials: "same-origin",
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json().catch(() => ({})) : null;
  if (!response.ok) {
    const error = new Error(body?.error?.message || body?.error || body?.message || (response.status === 401 || response.status === 403 ? "This account does not have access to the operations console." : `Request failed (${response.status}).`));
    error.status = response.status;
    throw error;
  }
  return body;
}

export const fmtNumber = (value) => new Intl.NumberFormat("en-US").format(Number(value) || 0);
export const fmtDate = (value, opts = {}) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", ...opts }).format(new Date(value)) : "—";
export const fmtDateTime = (value) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "—";
export const batchStatus = (batch) => {
  const value = String(batch.status || (Number(batch.disabledCount) ? "attention" : "generated")).replaceAll("_", " ");
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export function downloadHref(batchId, format, offset = 0, limit = 500) {
  const params = new URLSearchParams({ format, offset: String(offset), limit: String(limit) });
  return `/api/admin/batches/${encodeURIComponent(batchId)}/export?${params.toString()}`;
}

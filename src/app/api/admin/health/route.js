import { requireAdmin, tokenEncryptionReady, appOriginReady } from "@/lib/admin-helpers.js";
import { query } from "@/lib/db.js";
import { emailReady } from "@/lib/email.js";
import { json } from "@/lib/http.js";
import { getRequestOrigin } from "@/lib/app-origin.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  const checkedAt = new Date().toISOString();
  let database = "ready";
  let issuance = "ready";
  let lastError = null;
  try {
    await query("SELECT 1");
  } catch {
    database = "unavailable";
    issuance = "unavailable";
    lastError = "Database unavailable";
  }
  if (database === "ready") {
    try {
      const result = await query("SELECT to_regclass('boxsave.labels') AS labels, to_regclass('boxsave.label_batches') AS batches, to_regclass('boxsave.schema_migrations') AS migrations");
      if (!result.rows[0].labels || !result.rows[0].batches || !result.rows[0].migrations) throw new Error("missing");
    } catch {
      issuance = "unavailable";
      lastError = "Issuance tables unavailable";
    }
  }
  const qrSecret = tokenEncryptionReady() ? "configured" : "missing";
  const requestOrigin = getRequestOrigin(request);
  const appOriginReadyForRequest = Boolean(requestOrigin && appOriginReady(requestOrigin));
  const appOrigin = appOriginReadyForRequest ? "ready" : "unavailable";
  const appOriginSource = process.env.APP_ORIGIN ? "configured" : "request-fallback";
  const qrExport = issuance === "ready" && qrSecret === "configured" && appOriginReadyForRequest ? "ready" : "unavailable";
  if (!lastError && qrSecret === "missing") lastError = "QR encryption key missing";
  if (!lastError && !appOriginReadyForRequest) lastError = "Application origin missing or invalid";
  return json({ health: { database, issuance, qrExport, qrSecret,
    appOrigin, appOriginSource, passwordRecovery: emailReady() ? "ready" : "unavailable", lastError, checkedAt } });
}

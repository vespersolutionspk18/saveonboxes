import { requireAdmin } from "@/lib/admin-helpers.js";
import { query } from "@/lib/db.js";
import { errorResponse, json } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const metricsResult = await query("SELECT " +
      "(SELECT count(*)::int FROM boxsave.labels) AS \"labelsTotal\", " +
      "(SELECT count(*)::int FROM boxsave.labels l WHERE l.disabled_at IS NULL AND NOT EXISTS (SELECT 1 FROM boxsave.boxes b WHERE b.label_id = l.id)) AS \"labelsAvailable\", " +
      "(SELECT count(*)::int FROM boxsave.labels l JOIN boxsave.boxes b ON b.label_id = l.id WHERE l.disabled_at IS NULL) AS \"labelsClaimed\", " +
      "(SELECT count(*)::int FROM boxsave.labels WHERE disabled_at IS NOT NULL) AS \"labelsDisabled\", " +
      "(SELECT count(*)::int FROM boxsave.users WHERE role = 'customer') AS \"accountsTotal\", " +
      "(SELECT count(*)::int FROM boxsave.boxes) AS \"boxesTotal\", " +
      "(SELECT count(*)::int FROM boxsave.scan_events WHERE event_kind IN ('url_open','camera_scan')) AS \"scanEventsTotal\", " +
      "(SELECT count(*)::int FROM boxsave.scan_events WHERE event_kind IN ('url_open','camera_scan') AND created_at >= date_trunc('day', now())) AS \"scansToday\", " +
      "(SELECT count(*)::int FROM boxsave.scan_events WHERE outcome = 'claim_created' AND created_at >= date_trunc('day', now())) AS \"claimsToday\"");
    const recent = await query("SELECT e.id, e.event_kind AS \"eventKind\", e.source, e.outcome, e.created_at AS \"createdAt\", " +
      "l.id AS \"labelId\", l.short_serial AS serial, l.serial AS \"legacySerial\", u.id AS \"userId\", u.email, b.id AS \"boxId\", b.box_number AS \"boxNumber\" " +
      "FROM boxsave.scan_events e LEFT JOIN boxsave.labels l ON l.id = e.label_id " +
      "LEFT JOIN boxsave.users u ON u.id = e.actor_user_id LEFT JOIN boxsave.boxes b ON b.label_id = l.id " +
      "ORDER BY e.created_at DESC LIMIT 25");
    return json({ metrics: metricsResult.rows[0], recentActivity: recent.rows });
  } catch (error) {
    return errorResponse(error);
  }
}

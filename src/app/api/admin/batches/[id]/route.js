import { requireAdmin } from "@/lib/admin-helpers.js";
import { query } from "@/lib/db.js";
import { errorResponse, fail, json } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, context) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const { id } = await context.params;
    const result = await query("SELECT lb.id, lb.name, lb.quantity, lb.layout, lb.created_at AS \"createdAt\", " +
      "count(l.id) FILTER (WHERE l.disabled_at IS NULL AND b.id IS NULL)::int AS \"availableCount\", " +
      "count(l.id) FILTER (WHERE l.disabled_at IS NULL AND b.id IS NOT NULL)::int AS \"claimedCount\", " +
      "count(l.id) FILTER (WHERE l.disabled_at IS NOT NULL)::int AS \"disabledCount\", " +
      "count(DISTINCT e.event_id)::int AS \"scanCount\" " +
      "FROM boxsave.label_batches lb LEFT JOIN boxsave.labels l ON l.batch_id = lb.id " +
      "LEFT JOIN boxsave.boxes b ON b.label_id = l.id " +
      "LEFT JOIN boxsave.scan_events e ON e.label_id = l.id AND e.event_kind IN ('url_open', 'camera_scan') " +
      "WHERE lb.id = $1 GROUP BY lb.id LIMIT 1", [id]);
    if (!result.rowCount) return fail("Batch not found", 404, "batch_not_found");
    const row = result.rows[0];
    const batch = { id: row.id, name: row.name, quantity: row.quantity, layout: row.layout,
      createdAt: row.createdAt, status: "generated", availableCount: row.availableCount,
      claimedCount: row.claimedCount, disabledCount: row.disabledCount, scanCount: row.scanCount };
    return json({ batch, stats: { available: row.availableCount, claimed: row.claimedCount,
      disabled: row.disabledCount, scans: row.scanCount } });
  } catch (error) {
    return errorResponse(error);
  }
}

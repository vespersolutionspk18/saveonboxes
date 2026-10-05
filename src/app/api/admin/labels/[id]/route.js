import { requireAdmin, labelStatusSql } from "@/lib/admin-helpers.js";
import { query } from "@/lib/db.js";
import { errorResponse, fail, json } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, context) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const { id } = await context.params;
    const result = await query("SELECT l.id, l.short_serial AS serial, l.serial AS \"legacySerial\", l.batch_id AS \"batchId\", lb.name AS \"batchName\", " +
      labelStatusSql + " AS status, l.created_at AS \"createdAt\", l.disabled_at AS \"disabledAt\", " +
      "b.created_at AS \"claimedAt\", CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id',u.id,'email',u.email) END AS owner, " +
      "CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object('id',b.id,'boxNumber',b.box_number, " +
      "'name',COALESCE(NULLIF(btrim(b.name),''),l.short_serial,'Box '||b.box_number::text),'defaultName',COALESCE(l.short_serial,'Box '||b.box_number::text),'labelSerial',l.short_serial,'status',b.status,'roomId',b.room_id,'roomName',r.name, " +
      "'originRoomId',b.origin_room_id,'originRoomName',ro.name) END AS box, " +
      "count(e.id) FILTER (WHERE e.event_kind IN ('url_open','camera_scan'))::int AS scans, " +
      "min(e.created_at) FILTER (WHERE e.event_kind IN ('url_open','camera_scan')) AS \"firstScannedAt\", " +
      "max(e.created_at) FILTER (WHERE e.event_kind IN ('url_open','camera_scan')) AS \"lastScannedAt\" " +
      "FROM boxsave.labels l JOIN boxsave.label_batches lb ON lb.id = l.batch_id " +
      "LEFT JOIN boxsave.boxes b ON b.label_id = l.id LEFT JOIN boxsave.users u ON u.id = b.owner_id " +
      "LEFT JOIN boxsave.rooms r ON r.id = b.room_id LEFT JOIN boxsave.rooms ro ON ro.id = b.origin_room_id " +
      "LEFT JOIN boxsave.scan_events e ON e.label_id = l.id WHERE l.id = $1 " +
      "GROUP BY l.id, lb.id, b.id, u.id, r.id, ro.id LIMIT 1", [id]);
    if (!result.rowCount) return fail("Label not found", 404, "label_not_found");
    const label = result.rows[0];
    const [events, audit, itemResult] = await Promise.all([
      query("SELECT e.id, e.event_kind AS \"eventKind\", e.source, e.outcome, e.created_at AS \"createdAt\", " +
        "CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id',u.id,'email',u.email) END AS actor " +
        "FROM boxsave.scan_events e LEFT JOIN boxsave.users u ON u.id = e.actor_user_id " +
        "WHERE e.label_id = $1 ORDER BY e.created_at DESC LIMIT 100", [id]),
      query("SELECT a.id, a.action, a.reason, a.before_data AS before, a.after_data AS after, " +
        "a.created_at AS \"createdAt\", CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id',u.id,'email',u.email) END AS actor " +
        "FROM boxsave.admin_audit_events a LEFT JOIN boxsave.users u ON u.id = a.actor_admin_id " +
        "WHERE a.target_type = 'label' AND a.target_id = $1 ORDER BY a.created_at DESC LIMIT 100", [id]),
      label.box?.id ? query("SELECT i.id, i.name, i.quantity, i.notes, i.sort_order AS \"sortOrder\", " +
        "(im.item_id IS NOT NULL) AS \"hasImage\" FROM boxsave.box_items i " +
        "LEFT JOIN boxsave.item_images im ON im.item_id = i.id WHERE i.box_id = $1 ORDER BY i.sort_order, i.created_at", [label.box.id])
        : Promise.resolve({ rows: [] }),
    ]);
    return json({ label, items: itemResult.rows, events: events.rows, audit: audit.rows });
  } catch (error) {
    return errorResponse(error);
  }
}

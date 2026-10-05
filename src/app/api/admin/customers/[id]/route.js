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
    const result = await query("SELECT id, email, phone, role, disabled_at AS \"disabledAt\", created_at AS \"createdAt\", updated_at AS \"updatedAt\" " +
      "FROM boxsave.users WHERE id = $1 AND role = 'customer' LIMIT 1", [id]);
    if (!result.rowCount) return fail("Customer not found", 404, "customer_not_found");
    const user = result.rows[0];
    const [counts, boxes, labels, activity] = await Promise.all([
      query("SELECT (SELECT count(*)::int FROM boxsave.boxes WHERE owner_id = $1) AS boxes, " +
        "(SELECT count(*)::int FROM boxsave.boxes WHERE owner_id = $1 AND label_id IS NOT NULL) AS labels, " +
        "(SELECT count(*)::int FROM boxsave.scan_events WHERE actor_user_id = $1) AS \"scanEvents\"", [id]),
      query("SELECT b.id, b.box_number AS \"boxNumber\", COALESCE(NULLIF(btrim(b.name),''),l.short_serial,'Box '||b.box_number::text) AS name, " +
        "COALESCE(l.short_serial,'Box '||b.box_number::text) AS \"defaultName\", l.short_serial AS \"labelSerial\", " +
        "b.status, b.created_at AS \"createdAt\", r.name AS \"roomName\", ro.name AS \"originRoomName\", " +
        "count(i.id)::int AS \"itemCount\", " +
        "COALESCE(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'quantity',i.quantity,'notes',i.notes, " +
        "'sortOrder',i.sort_order,'hasImage',im.item_id IS NOT NULL) ORDER BY i.sort_order,i.created_at) " +
        "FILTER (WHERE i.id IS NOT NULL),'[]'::jsonb) AS items FROM boxsave.boxes b " +
        "LEFT JOIN boxsave.labels l ON l.id = b.label_id LEFT JOIN boxsave.rooms r ON r.id = b.room_id LEFT JOIN boxsave.rooms ro ON ro.id = b.origin_room_id " +
        "LEFT JOIN boxsave.box_items i ON i.box_id = b.id LEFT JOIN boxsave.item_images im ON im.item_id = i.id " +
        "WHERE b.owner_id = $1 GROUP BY b.id, l.short_serial, r.name, ro.name ORDER BY b.box_number DESC LIMIT 100", [id]),
      query("SELECT l.id, l.short_serial AS serial, l.serial AS \"legacySerial\", l.created_at AS \"createdAt\", l.disabled_at AS \"disabledAt\", " +
        "lb.id AS \"batchId\", lb.name AS \"batchName\", b.id AS \"boxId\", b.box_number AS \"boxNumber\" " +
        "FROM boxsave.boxes b JOIN boxsave.labels l ON l.id = b.label_id " +
        "JOIN boxsave.label_batches lb ON lb.id = l.batch_id WHERE b.owner_id = $1 ORDER BY l.created_at DESC LIMIT 100", [id]),
      query("SELECT e.id, e.event_kind AS \"eventKind\", e.source, e.outcome, e.created_at AS \"createdAt\", " +
        "l.id AS \"labelId\", l.short_serial AS serial, l.serial AS \"legacySerial\", b.id AS \"boxId\", b.box_number AS \"boxNumber\" " +
        "FROM boxsave.scan_events e LEFT JOIN boxsave.labels l ON l.id = e.label_id " +
        "LEFT JOIN boxsave.boxes b ON b.label_id = l.id WHERE e.actor_user_id = $1 ORDER BY e.created_at DESC LIMIT 50", [id]),
    ]);
    const customer = { id: user.id, email: user.email, phone: user.phone, role: user.role,
      status: user.disabledAt ? "disabled" : "active", disabledAt: user.disabledAt,
      createdAt: user.createdAt, updatedAt: user.updatedAt, counts: counts.rows[0], boxes: boxes.rows, labels: labels.rows };
    return json({ customer, recentActivity: activity.rows });
  } catch (error) {
    return errorResponse(error);
  }
}

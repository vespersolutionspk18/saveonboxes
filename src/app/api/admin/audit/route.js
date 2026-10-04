import { requireAdmin } from "@/lib/admin-helpers.js";
import { query } from "@/lib/db.js";
import { errorResponse, json } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
    const pageSize = Math.max(1, Math.min(250, Number.parseInt(params.get("pageSize") || "50", 10) || 50));
    const values = [];
    const clauses = [];
    const add = (value) => { values.push(value); return "$" + values.length; };
    const targetType = params.get("targetType");
    if (targetType) clauses.push("a.target_type = " + add(targetType.slice(0, 60)));
    const targetId = params.get("targetId");
    if (targetId) clauses.push("a.target_id = " + add(targetId.slice(0, 120)));
    const actorId = params.get("actorId");
    if (actorId && /^[0-9a-f-]{36}$/i.test(actorId)) clauses.push("a.actor_admin_id = " + add(actorId));
    const search = (params.get("query") || "").trim().slice(0, 100);
    if (search) {
      const pattern = add("%" + search.replace(/[\\%_]/g, "\\$&") + "%");
      clauses.push("(a.action ILIKE " + pattern + " ESCAPE E'\\\\' OR a.reason ILIKE " + pattern +
        " ESCAPE E'\\\\' OR a.target_id ILIKE " + pattern + " ESCAPE E'\\\\' OR u.email ILIKE " + pattern + " ESCAPE E'\\\\')");
    }
    const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
    const count = await query("SELECT count(*)::int AS total FROM boxsave.admin_audit_events a LEFT JOIN boxsave.users u ON u.id = a.actor_admin_id " + where, values);
    const result = await query("SELECT a.id, a.action, a.target_type AS \"targetType\", a.target_id AS \"targetId\", a.reason, " +
      "a.before_data AS before, a.after_data AS after, a.created_at AS \"createdAt\", " +
      "CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id',u.id,'email',u.email) END AS actor " +
      "FROM boxsave.admin_audit_events a LEFT JOIN boxsave.users u ON u.id = a.actor_admin_id " + where +
      " ORDER BY a.created_at DESC LIMIT $" + (values.length + 1) + " OFFSET $" + (values.length + 2),
    [...values, pageSize, (page - 1) * pageSize]);
    return json({ events: result.rows, page, pageSize, total: count.rows[0].total });
  } catch (error) {
    return errorResponse(error);
  }
}

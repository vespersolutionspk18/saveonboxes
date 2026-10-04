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
    const pageSize = Math.max(1, Math.min(100, Number.parseInt(params.get("pageSize") || "25", 10) || 25));
    const search = (params.get("query") || "").trim().slice(0, 120);
    const status = params.get("status");
    const values = [];
    const clauses = ["u.role = 'customer'"];
    const summaryClauses = ["u.role = 'customer'"];
    if (search) {
      values.push("%" + search.replace(/[\\%_]/g, "\\$&") + "%");
      const searchClause = "(u.email ILIKE $" + values.length + " ESCAPE E'\\\\' OR u.phone ILIKE $" + values.length + " ESCAPE E'\\\\' OR u.id::text ILIKE $" + values.length + ")";
      clauses.push(searchClause);
      summaryClauses.push(searchClause);
    }
    if (status === "active") clauses.push("u.disabled_at IS NULL");
    if (status === "disabled") clauses.push("u.disabled_at IS NOT NULL");
    const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
    const summaryWhere = summaryClauses.length ? "WHERE " + summaryClauses.join(" AND ") : "";
    const count = await query("SELECT count(*)::int AS total FROM boxsave.users u " + where, values);
    const summary = await query("SELECT count(*)::int AS total, count(*) FILTER (WHERE u.disabled_at IS NULL)::int AS active, " +
      "count(*) FILTER (WHERE u.disabled_at IS NOT NULL)::int AS disabled FROM boxsave.users u " + summaryWhere, values);
    const result = await query("SELECT u.id, u.email, u.phone, u.role, " +
      "CASE WHEN u.disabled_at IS NULL THEN 'active' ELSE 'disabled' END AS status, " +
      "u.created_at AS \"createdAt\", " +
      "(SELECT count(*)::int FROM boxsave.boxes b WHERE b.owner_id = u.id) AS \"boxesCount\", " +
      "(SELECT count(*)::int FROM boxsave.boxes b WHERE b.owner_id = u.id AND b.label_id IS NOT NULL) AS \"labelsCount\", " +
      "(SELECT count(*)::int FROM boxsave.scan_events e WHERE e.actor_user_id = u.id) AS \"scanEvents\" " +
      "FROM boxsave.users u " + where + " ORDER BY u.created_at DESC LIMIT $" + (values.length + 1) +
      " OFFSET $" + (values.length + 2), [...values, pageSize, (page - 1) * pageSize]);
    const customers = result.rows.map((row) => ({ id: row.id, email: row.email, phone: row.phone,
      role: row.role, status: row.status, createdAt: row.createdAt, boxesCount: row.boxesCount,
      labelsCount: row.labelsCount, scanEventsCount: row.scanEvents }));
    return json({ customers, page, pageSize, total: count.rows[0].total,
      summary: { total: summary.rows[0].total, active: summary.rows[0].active, disabled: summary.rows[0].disabled } });
  } catch (error) {
    return errorResponse(error);
  }
}

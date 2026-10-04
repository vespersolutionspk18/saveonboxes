import { requireUser } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { boxSummarySelect } from "@/lib/box-queries.js";
import { errorResponse, json } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const params = new URL(request.url).searchParams;
    const limit = Math.max(1, Math.min(250, Number.parseInt(params.get("limit") || params.get("pageSize") || "50", 10) || 50));
    const page = Math.max(1, Math.min(100000, Number.parseInt(params.get("page") || "1", 10) || 1));
    const requestedOffset = params.get("offset");
    const offset = Math.max(0, Math.min(1_000_000, requestedOffset === null ? (page - 1) * limit : Number.parseInt(requestedOffset, 10) || 0));
    const pageSize = limit;
    const search = (params.get("query") || "").trim().slice(0, 120);
    const roomId = params.get("roomId");
    const status = params.get("status");
    const includeArchived = params.get("includeArchived") === "true";
    const clauses = ["b.owner_id = $1"];
    const values = [user.id];
    const add = (value) => { values.push(value); return `$${values.length}`; };
    if (!includeArchived) clauses.push("b.archived_at IS NULL");
    if (roomId && /^[0-9a-f-]{36}$/i.test(roomId)) clauses.push(`b.room_id = ${add(roomId)}`);
    if (["packing", "packed", "unpacked"].includes(status)) clauses.push(`b.status = ${add(status)}`);
    let searchPattern = null;
    if (search) {
      searchPattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      const needle = add(searchPattern);
      clauses.push(`(b.name ILIKE ${needle} ESCAPE E'\\\\' OR b.notes ILIKE ${needle} ESCAPE E'\\\\' OR EXISTS (
        SELECT 1 FROM boxsave.box_items si WHERE si.box_id = b.id AND (si.name ILIKE ${needle} ESCAPE E'\\\\' OR si.notes ILIKE ${needle} ESCAPE E'\\\\')
      ))`);
    }
    const where = clauses.join(" AND ");
    const rows = await query(`${boxSummarySelect} WHERE ${where} ORDER BY b.box_number DESC LIMIT ${add(pageSize)} OFFSET ${add(offset)}`, values);
    let boxes = rows.rows;
    if (searchPattern && boxes.length) {
      const matches = await query(`SELECT box_id, jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity) ORDER BY sort_order, created_at) AS items
        FROM boxsave.box_items WHERE box_id = ANY($1::uuid[]) AND (name ILIKE $2 ESCAPE E'\\\\' OR notes ILIKE $2 ESCAPE E'\\\\')
        GROUP BY box_id`, [boxes.map((box) => box.id), searchPattern]);
      const byBox = new Map(matches.rows.map((row) => [row.box_id, row.items]));
      boxes = boxes.map((box) => ({ ...box, matchingItems: byBox.get(box.id) || [] }));
    }
    const summary = await query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE b.status = 'packed')::int AS packed,
      count(*) FILTER (WHERE b.status = 'packing')::int AS packing,
      count(*) FILTER (WHERE b.status = 'unpacked')::int AS unpacked,
      coalesce(sum(item_count.count), 0)::int AS items
      FROM boxsave.boxes b
      LEFT JOIN LATERAL (SELECT count(*)::int AS count FROM boxsave.box_items i WHERE i.box_id = b.id) item_count ON true
      WHERE ${where}`, values.slice(0, values.length - 2));
    return json({ boxes, page, pageSize, limit, offset, total: summary.rows[0].total,
      summary: { packed: summary.rows[0].packed, packing: summary.rows[0].packing, unpacked: summary.rows[0].unpacked, items: summary.rows[0].items } });
  } catch (error) {
    return errorResponse(error);
  }
}

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
    const roomId = params.get("roomId");
    const status = params.get("status");
    const values = [user.id];
    const clauses = ["b.owner_id = $1", "b.archived_at IS NULL"];
    if (roomId && /^[0-9a-f-]{36}$/i.test(roomId)) { values.push(roomId); clauses.push(`b.room_id = $${values.length}`); }
    if (["packing", "packed", "unpacked"].includes(status)) { values.push(status); clauses.push(`b.status = $${values.length}`); }
    const boxesResult = await query(`${boxSummarySelect} WHERE ${clauses.join(" AND ")} ORDER BY r.name NULLS LAST, b.box_number`, values);
    const boxes = boxesResult.rows;
    if (boxes.length) {
      const itemResult = await query(`SELECT id, box_id AS "boxId", name, quantity, notes, sort_order AS "sortOrder"
        FROM boxsave.box_items WHERE box_id = ANY($1::uuid[]) ORDER BY sort_order, created_at`, [boxes.map((box) => box.id)]);
      const byBox = new Map();
      for (const item of itemResult.rows) {
        const list = byBox.get(item.boxId) || [];
        list.push(item);
        byBox.set(item.boxId, list);
      }
      for (const box of boxes) box.items = byBox.get(box.id) || [];
    }
    const roomsResult = await query("SELECT id, name, color FROM boxsave.rooms WHERE owner_id = $1 ORDER BY lower(name)", [user.id]);
    return json({ boxes, rooms: roomsResult.rows, generatedAt: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}

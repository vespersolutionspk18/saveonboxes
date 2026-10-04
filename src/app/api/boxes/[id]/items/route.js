import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { checkSameOrigin, errorResponse, fail, json, readJson } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ name: z.string().trim().min(1).max(240), quantity: z.number().int().min(1).max(10000).default(1), notes: z.string().max(2000).nullable().optional() });

export async function POST(request, context) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const { id: boxId } = await context.params;
    const body = schema.parse(await readJson(request, 8 * 1024));
    const box = await query("SELECT id FROM boxsave.boxes WHERE id = $1 AND owner_id = $2 AND archived_at IS NULL", [boxId, user.id]);
    if (!box.rowCount) return fail("Box not found", 404, "box_not_found");
    const result = await query(`INSERT INTO boxsave.box_items(id, box_id, name, quantity, notes)
      VALUES ($1, $2, $3, $4, $5) RETURNING id, name, quantity, notes, sort_order AS "sortOrder", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [randomUUID(), boxId, body.name, body.quantity, body.notes?.trim() || null]);
    await query("UPDATE boxsave.boxes SET updated_at = now() WHERE id = $1", [boxId]);
    return json({ item: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (error?.name === "ZodError") return fail("Enter an item name and valid quantity", 400, "invalid_item");
    return errorResponse(error);
  }
}

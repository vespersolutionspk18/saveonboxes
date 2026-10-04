import { z } from "zod";
import { requireUser } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { checkSameOrigin, errorResponse, fail, json, readJson } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ name: z.string().trim().min(1).max(240).optional(), quantity: z.number().int().min(1).max(10000).optional(), notes: z.string().max(2000).nullable().optional(), sortOrder: z.number().int().min(0).max(100000).optional() });

export async function PATCH(request, context) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const body = schema.parse(await readJson(request, 8 * 1024));
    const fields = { name: "name", quantity: "quantity", notes: "notes", sortOrder: "sort_order" };
    const updates = [];
    const values = [id, user.id];
    for (const [key, column] of Object.entries(fields)) {
      if (!Object.hasOwn(body, key)) continue;
      let value = body[key];
      if (key === "name") value = value.trim();
      if (key === "notes" && typeof value === "string") value = value.trim() || null;
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    }
    if (!updates.length) return fail("Provide an inventory field to update", 400, "empty_update");
    const result = await query(`UPDATE boxsave.box_items i SET ${updates.join(", ")}, updated_at = now()
      FROM boxsave.boxes b WHERE i.id = $1 AND b.id = i.box_id AND b.owner_id = $2 AND b.archived_at IS NULL
      RETURNING i.id, i.box_id AS "boxId", i.name, i.quantity, i.notes, i.sort_order AS "sortOrder", i.updated_at AS "updatedAt"`, values);
    if (!result.rowCount) return fail("Inventory item not found", 404, "item_not_found");
    await query("UPDATE boxsave.boxes SET updated_at = now() WHERE id = $1", [result.rows[0].boxId]);
    return json({ item: result.rows[0] });
  } catch (error) {
    if (error?.name === "ZodError") return fail("Inventory details are invalid", 400, "invalid_item");
    return errorResponse(error);
  }
}

export async function DELETE(request, context) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const result = await query(`DELETE FROM boxsave.box_items i USING boxsave.boxes b
      WHERE i.id = $1 AND b.id = i.box_id AND b.owner_id = $2 AND b.archived_at IS NULL RETURNING b.id AS "boxId"`, [id, user.id]);
    if (!result.rowCount) return fail("Inventory item not found", 404, "item_not_found");
    await query("UPDATE boxsave.boxes SET updated_at = now() WHERE id = $1", [result.rows[0].boxId]);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

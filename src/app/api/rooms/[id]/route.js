import { z } from "zod";
import { requireUser } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { checkSameOrigin, errorResponse, fail, json, readJson } from "@/lib/http.js";

export const runtime = "nodejs";
const schema = z.object({ name: z.string().trim().min(1).max(80).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional() });

export async function PATCH(request, context) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const body = schema.parse(await readJson(request, 8 * 1024));
    const fields = [];
    const values = [id, user.id];
    for (const key of ["name", "color"]) {
      if (!Object.hasOwn(body, key)) continue;
      values.push(body[key]);
      fields.push(`${key} = $${values.length}`);
    }
    if (!fields.length) return fail("Provide a room field to update", 400, "empty_update");
    const result = await query(`UPDATE boxsave.rooms SET ${fields.join(", ")}, updated_at = now()
      WHERE id = $1 AND owner_id = $2 RETURNING id, name, color, updated_at AS "updatedAt"`, values);
    if (!result.rowCount) return fail("Room not found", 404, "room_not_found");
    return json({ room: result.rows[0] });
  } catch (error) {
    if (error?.name === "ZodError") return fail("Room details are invalid", 400, "invalid_room");
    if (error?.code === "23505") return fail("A room with that name already exists", 409, "room_exists");
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
    const result = await query("DELETE FROM boxsave.rooms WHERE id = $1 AND owner_id = $2 RETURNING id", [id, user.id]);
    if (!result.rowCount) return fail("Room not found", 404, "room_not_found");
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

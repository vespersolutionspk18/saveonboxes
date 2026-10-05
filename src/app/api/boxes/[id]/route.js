import { z } from "zod";
import { requireUser } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { getBoxDetail } from "@/lib/box-queries.js";
import { invalidOwnedRoomId } from "@/lib/box-room-validation.js";
import { checkSameOrigin, errorResponse, fail, json, readJson } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().max(120).nullable().optional(),
  roomId: z.string().uuid().nullable().optional(),
  originRoomId: z.string().uuid().nullable().optional(),
  status: z.enum(["packing", "packed", "unpacked"]).optional(),
  notes: z.string().max(5000).nullable().optional(),
  fragile: z.boolean().optional(),
  openEarly: z.boolean().optional(),
});

export async function GET(request, context) {
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const box = await getBoxDetail({ query }, user.id, id);
    return box ? json({ box }) : fail("Box not found", 404, "box_not_found");
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request, context) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const body = schema.parse(await readJson(request, 16 * 1024));
    if (Object.keys(body).length === 0) return fail("Provide at least one box field to update", 400, "empty_update");
    const invalidRoomId = await invalidOwnedRoomId(query, user.id, [body.roomId, body.originRoomId]);
    if (invalidRoomId) return fail("Choose rooms from your account", 400, "invalid_room");
    const fields = { name: "name", roomId: "room_id", originRoomId: "origin_room_id", status: "status", notes: "notes", fragile: "fragile", openEarly: "open_early" };
    const updates = [];
    const values = [user.id, id];
    for (const [key, column] of Object.entries(fields)) {
      if (!Object.hasOwn(body, key)) continue;
      let value = body[key];
      if ((key === "name" || key === "notes") && typeof value === "string") value = value.trim() || null;
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    }
    const result = await query(`UPDATE boxsave.boxes SET ${updates.join(", ")}, updated_at = now()
      WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL RETURNING id`, values);
    if (!result.rowCount) return fail("Box not found", 404, "box_not_found");
    return json({ box: await getBoxDetail({ query }, user.id, id) });
  } catch (error) {
    if (error?.name === "ZodError") return fail("One or more box details are invalid", 400, "invalid_box");
    return errorResponse(error);
  }
}

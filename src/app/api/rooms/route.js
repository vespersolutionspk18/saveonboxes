import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { checkSameOrigin, errorResponse, fail, json, readJson } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ name: z.string().trim().min(1).max(80), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional() });

export async function GET(request) {
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const { rows } = await query(`SELECT r.id, r.name, r.color, r.created_at AS "createdAt",
      count(b.id)::int AS "boxCount"
      FROM boxsave.rooms r LEFT JOIN boxsave.boxes b ON b.room_id = r.id AND b.archived_at IS NULL
      WHERE r.owner_id = $1 GROUP BY r.id ORDER BY lower(r.name), r.id`, [user.id]);
    return json({ rooms: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = schema.parse(await readJson(request, 8 * 1024));
    const { rows } = await query(`INSERT INTO boxsave.rooms(id, owner_id, name, color)
      VALUES ($1, $2, $3, $4) RETURNING id, name, color, created_at AS "createdAt"`, [randomUUID(), user.id, body.name, body.color || null]);
    return json({ room: rows[0] }, { status: 201 });
  } catch (error) {
    if (error?.name === "ZodError") return fail("Enter a room name and a valid color", 400, "invalid_room");
    if (error?.code === "23505") return fail("A room with that name already exists", 409, "room_exists");
    return errorResponse(error);
  }
}

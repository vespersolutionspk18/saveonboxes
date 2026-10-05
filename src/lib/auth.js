import { createHash, randomBytes } from "node:crypto";
import { query, withTransaction } from "@/lib/db.js";
import { json } from "@/lib/http.js";
import { newId } from "@/lib/security.js";
export { hashPassword, verifyPassword } from "@/lib/password.js";
const SESSION_DAYS = 30;
const SESSION_COOKIE = "sob_session";

function cookieToken(request) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return "";
}

export async function createSession(userId, client = null) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const execute = client ? client.query.bind(client) : query;
  await execute("INSERT INTO boxsave.sessions(token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [tokenHash, userId, expiresAt]);
  return { token, expiresAt };
}

export function sessionCookie(token, expiresAt) {
  const parts = [`${SESSION_COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Expires=${expiresAt.toUTCString()}`];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function expiredSessionCookie() {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export async function getCurrentUser(request) {
  const token = cookieToken(request);
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { rows } = await query(`
    SELECT u.id, u.email, u.phone, u.role
      FROM boxsave.sessions s
      JOIN boxsave.users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.disabled_at IS NULL
     LIMIT 1`, [tokenHash]);
  return rows[0] || null;
}

export async function requireUser(request) {
  const user = await getCurrentUser(request);
  return user || json({ error: { message: "Sign in to continue", code: "unauthenticated" } }, { status: 401 });
}

export async function requireAdmin(request) {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: { message: "Sign in to continue", code: "unauthenticated" } }, { status: 401 });
  if (user.role !== "super_admin") return json({ error: { message: "Administrator access is required", code: "forbidden" } }, { status: 403 });
  return user;
}

export async function userById(userId) {
  const { rows } = await query("SELECT id, email, phone, role FROM boxsave.users WHERE id = $1 AND disabled_at IS NULL", [userId]);
  return rows[0] || null;
}

export async function allocateBoxNumber(client, ownerId) {
  await client.query(`INSERT INTO boxsave.customer_counters(owner_id, next_box_number) VALUES ($1, 1)
    ON CONFLICT (owner_id) DO NOTHING`, [ownerId]);
  const { rows } = await client.query(`UPDATE boxsave.customer_counters
    SET next_box_number = next_box_number + 1 WHERE owner_id = $1 RETURNING next_box_number - 1 AS box_number`, [ownerId]);
  return Number(rows[0].box_number);
}

export async function createBox(client, { ownerId, labelId = null, roomId = null, name = null }) {
  const id = newId();
  const boxNumber = await allocateBoxNumber(client, ownerId);
  let labelSerial = null;
  if (labelId) {
    const label = await client.query("SELECT short_serial FROM boxsave.labels WHERE id = $1", [labelId]);
    if (!label.rowCount) throw new Error("Cannot create a box for an unknown label");
    labelSerial = label.rows[0].short_serial;
  }
  const displayName = typeof name === "string" && name.trim() ? name.trim() : (labelSerial || `Box ${boxNumber}`);
  const { rows } = await client.query(`INSERT INTO boxsave.boxes(id, owner_id, label_id, box_number, room_id, name)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, owner_id, label_id, box_number, name, room_id, status, notes, fragile,
      open_early, archived_at, created_at, updated_at`, [id, ownerId, labelId, boxNumber, roomId, displayName]);
  return rows[0];
}

export async function inTransaction(work) {
  return withTransaction(work);
}

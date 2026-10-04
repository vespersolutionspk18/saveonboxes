import { createHash } from "node:crypto";
import { expiredSessionCookie } from "@/lib/auth.js";
import { checkSameOrigin } from "@/lib/http.js";
import { query } from "@/lib/db.js";
import { json } from "@/lib/http.js";

export const runtime = "nodejs";

export async function POST(request) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("sob_session="))?.slice("sob_session=".length);
  if (token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await query("UPDATE boxsave.sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [tokenHash]);
  }
  return json({ ok: true }, { headers: { "set-cookie": expiredSessionCookie() } });
}

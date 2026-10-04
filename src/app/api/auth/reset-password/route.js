import { z } from "zod";
import { withTransaction } from "@/lib/db.js";
import { hashPassword } from "@/lib/password.js";
import { digest, consumeRateLimit } from "@/lib/security.js";
import { checkSameOrigin, clientAddress, errorResponse, fail, json, readJson } from "@/lib/http.js";

export const runtime = "nodejs";
const schema = z.object({ token: z.string().min(32).max(128), password: z.string().min(12).max(256) });

export async function POST(request) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const body = schema.parse(await readJson(request, 16 * 1024));
    const limited = await consumeRateLimit("password-reset-complete", clientAddress(request), 10, 60 * 60 * 1000);
    if (!limited.allowed) return fail("Too many password reset attempts. Try again later.", 429, "rate_limited");
    const tokenHash = digest(body.token);
    const passwordHash = await hashPassword(body.password);
    const changed = await withTransaction(async (client) => {
      const result = await client.query(`SELECT user_id FROM boxsave.password_reset_tokens
        WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now() FOR UPDATE`, [tokenHash]);
      if (!result.rowCount) return false;
      const userId = result.rows[0].user_id;
      await client.query("UPDATE boxsave.users SET password_hash = $2, updated_at = now() WHERE id = $1", [userId, passwordHash]);
      await client.query("UPDATE boxsave.sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
      await client.query("UPDATE boxsave.password_reset_tokens SET consumed_at = now() WHERE token_hash = $1", [tokenHash]);
      return true;
    });
    if (!changed) return fail("This reset link is invalid or has expired", 400, "invalid_reset_token");
    return json({ ok: true });
  } catch (error) {
    if (error?.name === "ZodError") return fail("Choose a password with at least 12 characters and use a valid reset link", 400, "invalid_reset");
    return errorResponse(error);
  }
}

import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { query } from "@/lib/db.js";
import { digest, consumeRateLimit } from "@/lib/security.js";
import { sendPasswordReset, emailReady } from "@/lib/email.js";
import { checkSameOrigin, clientAddress, errorResponse, fail, json, readJson } from "@/lib/http.js";
import { normalizeEmail } from "@/lib/identity.js";
import { appOriginReady } from "@/lib/admin-helpers.js";
import { getRequestOrigin, resolveAppOrigin } from "@/lib/app-origin.js";
import { safeRecoveryContinuation } from "@/lib/auth-navigation.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ email: z.string().email().max(254), next: z.string().max(512).optional() });

export async function POST(request) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const body = schema.parse(await readJson(request, 8 * 1024));
    const email = normalizeEmail(body.email);
    const [ipLimit, emailLimit] = await Promise.all([
      consumeRateLimit("password-reset-ip", clientAddress(request), 8, 60 * 60 * 1000),
      consumeRateLimit("password-reset-email", email, 3, 60 * 60 * 1000),
    ]);
    if (!ipLimit.allowed || !emailLimit.allowed) return fail("Too many reset requests. Try again later.", 429, "rate_limited");
    const requestOrigin = getRequestOrigin(request);
    if (!requestOrigin || !emailReady() || !appOriginReady(requestOrigin)) return fail("Password recovery is temporarily unavailable", 503, "email_unavailable");
    const { rows } = await query("SELECT id, email FROM boxsave.users WHERE email = $1 AND disabled_at IS NULL LIMIT 1", [email]);
    if (rows[0]) {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = digest(token);
      await query("INSERT INTO boxsave.password_reset_tokens(token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [tokenHash, rows[0].id]);
      const origin = resolveAppOrigin({ configuredOrigin: process.env.APP_ORIGIN, requestOrigin });
      const resetUrl = new URL("/reset-password", origin);
      resetUrl.searchParams.set("token", token);
      const continuation = safeRecoveryContinuation(body.next);
      if (continuation) resetUrl.searchParams.set("next", continuation);
      try {
        await sendPasswordReset(rows[0].email, resetUrl.toString());
      } catch {
        await query("UPDATE boxsave.password_reset_tokens SET consumed_at = now() WHERE token_hash = $1", [tokenHash]).catch(() => {});
        return fail("Password recovery is temporarily unavailable", 503, "email_unavailable");
      }
    }
    return json({ ok: true, message: "If an account exists for that email, a reset link has been sent." }, { status: 202 });
  } catch (error) {
    if (error?.name === "ZodError") return fail("Enter a valid email address", 400, "invalid_email");
    return errorResponse(error);
  }
}

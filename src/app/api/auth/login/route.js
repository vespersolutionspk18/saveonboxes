import { z } from "zod";
import { query } from "@/lib/db.js";
import { createSession, sessionCookie, verifyPassword } from "@/lib/auth.js";
import { normalizeEmail } from "@/lib/identity.js";
import { consumeRateLimit } from "@/lib/security.js";
import { checkSameOrigin, clientAddress, errorResponse, fail, json, readJson } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256) });
const dummyHash = `scrypt$32768$8$1$${Buffer.alloc(16).toString("base64url")}$${Buffer.alloc(64).toString("base64url")}`;

export async function POST(request) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  let stage = "validate input";
  try {
    const body = schema.parse(await readJson(request, 16 * 1024));
    const email = normalizeEmail(body.email);
    const ip = clientAddress(request);
    stage = "apply login rate limits";
    const [ipLimit, emailLimit] = await Promise.all([
      consumeRateLimit("login-ip", ip, 25, 15 * 60 * 1000),
      consumeRateLimit("login-email", email, 8, 15 * 60 * 1000),
    ]);
    if (!ipLimit.allowed || !emailLimit.allowed) return fail("Too many sign-in attempts. Try again later.", 429, "rate_limited");
    stage = "find account";
    const { rows } = await query("SELECT id, email, phone, role, password_hash FROM boxsave.users WHERE email = $1 AND disabled_at IS NULL LIMIT 1", [email]);
    const record = rows[0];
    stage = "verify password";
    const valid = await verifyPassword(body.password, record?.password_hash || dummyHash);
    if (!record || !valid) return fail("Email or password is incorrect", 401, "invalid_credentials");
    const user = { id: record.id, email: record.email, phone: record.phone, role: record.role };
    stage = "create session";
    const session = await createSession(user.id);
    return json({ user }, { headers: { "set-cookie": sessionCookie(session.token, session.expiresAt) } });
  } catch (error) {
    if (error?.name === "ZodError") return fail("Enter a valid email and password", 400, "invalid_credentials");
    console.error("[api/auth/login] Sign-in failed", {
      stage,
      name: typeof error?.name === "string" ? error.name : "Error",
      code: typeof error?.code === "string" ? error.code : undefined,
      constraint: typeof error?.constraint === "string" ? error.constraint : undefined,
      table: typeof error?.table === "string" ? error.table : undefined,
      column: typeof error?.column === "string" ? error.column : undefined,
    });
    return errorResponse(error);
  }
}

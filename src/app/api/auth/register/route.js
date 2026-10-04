import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withTransaction } from "@/lib/db.js";
import { createSession, hashPassword, sessionCookie } from "@/lib/auth.js";
import { normalizeEmail, normalizePhone } from "@/lib/identity.js";
import { consumeRateLimit } from "@/lib/security.js";
import { checkSameOrigin, clientAddress, errorResponse, fail, json, readJson } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email().max(254), password: z.string().min(12).max(256), phone: z.string().min(7).max(40) });

export async function POST(request) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  let stage = "validate input";
  try {
    const body = schema.parse(await readJson(request, 16 * 1024));
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    if (!phone) return fail("Enter a valid phone number", 400, "invalid_phone");
    const ip = clientAddress(request);
    stage = "apply IP signup limit";
    const ipLimit = await consumeRateLimit("register-ip", ip, 10, 60 * 60 * 1000);
    stage = "apply email signup limit";
    const emailLimit = await consumeRateLimit("register-email", email, 4, 24 * 60 * 60 * 1000);
    if (!ipLimit.allowed || !emailLimit.allowed) return fail("Too many signup attempts. Try again later.", 429, "rate_limited");

    stage = "hash password";
    const passwordHash = await hashPassword(body.password);
    stage = "create account, box counter, and session";
    const created = await withTransaction(async (client) => {
      const id = randomUUID();
      const result = await client.query(`INSERT INTO boxsave.users(id, email, password_hash, phone)
        VALUES ($1, $2, $3, $4) RETURNING id, email, phone, role`, [id, email, passwordHash, phone]);
      await client.query("INSERT INTO boxsave.customer_counters(owner_id, next_box_number) VALUES ($1, 1)", [id]);
      const session = await createSession(result.rows[0].id, client);
      return { user: result.rows[0], session };
    });
    return json({ user: created.user }, { status: 201, headers: { "set-cookie": sessionCookie(created.session.token, created.session.expiresAt) } });
  } catch (error) {
    if (error?.name === "ZodError") return fail("Enter a valid email, password (at least 12 characters), and phone number", 400, "invalid_registration");
    if (error?.code === "23505") return fail("An account with that email already exists", 409, "email_exists");
    console.error("[api/auth/register] Signup failed", {
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

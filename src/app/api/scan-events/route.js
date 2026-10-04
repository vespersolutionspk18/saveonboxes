import { randomUUID } from "node:crypto";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db.js";
import { getCurrentUser } from "@/lib/auth.js";
import { tokenHash, isLabelToken } from "@/lib/label-tokens.js";
import { consumeRateLimit } from "@/lib/security.js";
import { clientAddress, errorResponse, fail, json, readJson } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ token: z.string().min(24).max(64), eventId: z.string().uuid().optional(), source: z.enum(["url", "camera"]).default("url") });

export async function POST(request) {
  try {
    const body = schema.parse(await readJson(request, 8 * 1024));
    if (!isLabelToken(body.token)) return fail("This QR code is not recognized", 404, "label_not_found");
    const ip = clientAddress(request);
    const limited = await consumeRateLimit("scan-ip", ip, 120, 10 * 60 * 1000);
    if (!limited.allowed) return fail("Too many scans. Try again shortly.", 429, "rate_limited");
    const eventId = body.eventId || randomUUID();
    const hash = tokenHash(body.token);
    const user = await getCurrentUser(request).catch(() => null);
    const event = await withTransaction(async (client) => {
      const { rows } = await client.query("SELECT id, disabled_at FROM boxsave.labels WHERE token_hash = $1 LIMIT 1", [hash]);
      const label = rows[0];
      const outcome = !label ? "invalid" : label.disabled_at ? "disabled" : "opened";
      const eventKind = !label ? "invalid" : body.source === "camera" ? "camera_scan" : "url_open";
      const inserted = await client.query(`INSERT INTO boxsave.scan_events(id, event_id, label_id, token_hash, actor_user_id, event_kind, source, outcome)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (event_id) DO NOTHING RETURNING id`, [randomUUID(), eventId, label?.id || null, hash, user?.id || null, eventKind, body.source, outcome]);
      if (inserted.rowCount) return { outcome, recorded: true };
      const existing = await client.query("SELECT token_hash, outcome FROM boxsave.scan_events WHERE event_id = $1", [eventId]);
      if (existing.rows[0]?.token_hash !== hash) return { outcome: "event_conflict", recorded: false };
      return { outcome: existing.rows[0].outcome, recorded: false };
    });
    if (event.outcome === "event_conflict") return fail("This scan event was already used", 409, "event_conflict");
    return json({ eventId, recorded: event.recorded, deduplicated: !event.recorded, outcome: event.outcome });
  } catch (error) {
    if (error?.name === "ZodError") return fail("Invalid scan event", 400, "invalid_scan");
    return errorResponse(error);
  }
}

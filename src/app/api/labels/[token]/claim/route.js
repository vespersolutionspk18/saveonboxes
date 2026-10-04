import { randomUUID } from "node:crypto";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db.js";
import { requireUser, createBox } from "@/lib/auth.js";
import { getBoxDetail } from "@/lib/box-queries.js";
import { tokenHash, isLabelToken } from "@/lib/label-tokens.js";
import { consumeRateLimit } from "@/lib/security.js";
import { checkSameOrigin, clientAddress, errorResponse, fail, json } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ eventId: z.string().uuid().optional(), source: z.enum(["url", "camera"]).default("url") }).default({});

export async function POST(request, context) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const { token } = await context.params;
    if (!isLabelToken(token)) return fail("This QR code is not recognized", 404, "label_not_found");
      let payload = {};
      const rawBody = await request.text();
      if (Buffer.byteLength(rawBody, "utf8") > 4 * 1024) return fail("Request body is too large", 413, "body_too_large");
      if (rawBody.trim()) {
        try { payload = JSON.parse(rawBody); } catch { return fail("Invalid JSON request body", 400, "invalid_json"); }
      }
      const body = schema.parse(payload);
    const eventId = body.eventId || randomUUID();
    const hash = tokenHash(token);
    const [ipLimit, userLimit] = await Promise.all([
      consumeRateLimit("claim-ip", clientAddress(request), 90, 10 * 60 * 1000),
      consumeRateLimit("claim-user", user.id, 90, 10 * 60 * 1000),
    ]);
    if (!ipLimit.allowed || !userLimit.allowed) return fail("Too many scans. Try again shortly.", 429, "rate_limited");

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query("SELECT id, disabled_at FROM boxsave.labels WHERE token_hash = $1 FOR UPDATE", [hash]);
      const label = rows[0];
      if (!label) {
        await recordClaimEvent(client, { eventId, labelId: null, hash, userId: user.id, source: body.source, outcome: "invalid", kind: "invalid" });
        return { outcome: "invalid" };
      }
      if (label.disabled_at) {
        await recordClaimEvent(client, { eventId, labelId: label.id, hash, userId: user.id, source: body.source, outcome: "disabled", kind: "invalid" });
        return { outcome: "disabled" };
      }
      const current = await client.query("SELECT id, owner_id FROM boxsave.boxes WHERE label_id = $1 LIMIT 1", [label.id]);
      if (current.rows[0]) {
        if (current.rows[0].owner_id !== user.id) {
          await recordClaimEvent(client, { eventId, labelId: label.id, hash, userId: user.id, source: body.source, outcome: "already_claimed", kind: "claim_conflict" });
          return { outcome: "claimed_elsewhere" };
        }
        await recordClaimEvent(client, { eventId, labelId: label.id, hash, userId: user.id, source: body.source, outcome: "claim_existing", kind: "claim_existing" });
        return { outcome: "existing", boxId: current.rows[0].id };
      }
      const box = await createBox(client, { ownerId: user.id, labelId: label.id });
      await recordClaimEvent(client, { eventId, labelId: label.id, hash, userId: user.id, source: body.source, outcome: "claim_created", kind: "claim_created" });
      return { outcome: "created", boxId: box.id };
    });

    if (result.outcome === "invalid") return fail("This QR code is not recognized", 404, "label_not_found");
    if (result.outcome === "disabled") return fail("This QR code is not available. Contact support.", 410, "label_disabled");
    if (result.outcome === "claimed_elsewhere") return fail("This label is already connected to another account. Sign in with the account that claimed it or contact support.", 409, "label_claimed");
    const box = await queryBox(user.id, result.boxId);
    return json({ box, created: result.outcome === "created", eventId });
  } catch (error) {
    if (error?.name === "ZodError") return fail("Invalid claim request", 400, "invalid_claim");
    return errorResponse(error);
  }
}

async function queryBox(ownerId, boxId) {
  return getBoxDetail({ query }, ownerId, boxId);
}

async function recordClaimEvent(client, { eventId, labelId, hash, userId, source, outcome }) {
  const eventKind = labelId ? (source === "camera" ? "camera_scan" : "url_open") : "invalid";
  await client.query(`INSERT INTO boxsave.scan_events(id, event_id, label_id, token_hash, actor_user_id, event_kind, source, outcome)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (event_id) DO UPDATE SET actor_user_id = COALESCE(boxsave.scan_events.actor_user_id, EXCLUDED.actor_user_id),
      event_kind = EXCLUDED.event_kind, outcome = EXCLUDED.outcome
    WHERE boxsave.scan_events.token_hash = EXCLUDED.token_hash`, [randomUUID(), eventId, labelId, hash, userId, eventKind, source, outcome]);
}

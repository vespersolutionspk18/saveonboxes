import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withTransaction, query } from "@/lib/db.js";
import { requireAdmin, writeAdminAudit, appOriginReady } from "@/lib/admin-helpers.js";
import { encryptToken, tokenHash } from "@/lib/label-tokens.js";
import { newToken } from "@/lib/security.js";
import { checkSameOrigin, errorResponse, fail, json, readJson } from "@/lib/http.js";
import { getRequestOrigin } from "@/lib/app-origin.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const layoutSchema = z.object({
  cardWidthMm: z.number().min(50).max(110).default(85.6),
  cardHeightMm: z.number().min(30).max(80).default(54),
  cardsPerPage: z.number().int().min(1).max(12).default(1),
  includeSerial: z.boolean().default(true),
  includeWriteFields: z.boolean().default(true),
});
const createSchema = z.object({
  quantity: z.number().int().min(1).max(5000),
  name: z.string().trim().min(1).max(100).optional(),
  layout: layoutSchema.default({}),
});

function mapBatch(row) {
  return { id: row.id, name: row.name, quantity: row.quantity, claimedCount: row.claimedCount,
    disabledCount: row.disabledCount, availableCount: row.availableCount, scanCount: row.scanCount,
    createdAt: row.createdAt, status: row.status || "generated", layout: row.layout };
}

export async function GET(request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
    const pageSize = Math.max(1, Math.min(100, Number.parseInt(params.get("pageSize") || "25", 10) || 25));
    const name = (params.get("query") || "").trim().slice(0, 100);
    const values = [];
    let where = "";
    if (name) {
      values.push("%" + name.replace(/[\\%_]/g, "\\$&") + "%");
      where = "WHERE lb.name ILIKE $1 ESCAPE E'\\\\' OR lb.id::text ILIKE $1";
    }
    const count = await query("SELECT count(*)::int AS total FROM boxsave.label_batches lb " + where, values);
    const results = await query("SELECT lb.id, lb.name, lb.quantity, lb.layout, lb.created_at AS \"createdAt\", " +
      "count(DISTINCT b.id) FILTER (WHERE l.disabled_at IS NULL)::int AS \"claimedCount\", " +
      "count(DISTINCT l.id) FILTER (WHERE l.disabled_at IS NOT NULL)::int AS \"disabledCount\", " +
      "count(DISTINCT l.id) FILTER (WHERE l.disabled_at IS NULL AND b.id IS NULL)::int AS \"availableCount\", " +
      "count(DISTINCT e.event_id)::int AS \"scanCount\" " +
      "FROM boxsave.label_batches lb LEFT JOIN boxsave.labels l ON l.batch_id = lb.id " +
      "LEFT JOIN boxsave.boxes b ON b.label_id = l.id " +
      "LEFT JOIN boxsave.scan_events e ON e.label_id = l.id AND e.event_kind IN ('url_open','camera_scan') " +
      where + " GROUP BY lb.id ORDER BY lb.created_at DESC LIMIT $" + (values.length + 1) + " OFFSET $" + (values.length + 2),
    [...values, pageSize, (page - 1) * pageSize]);
    return json({ batches: results.rows.map(mapBatch), page, pageSize, total: count.rows[0].total });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const requestOrigin = getRequestOrigin(request);
    if (!requestOrigin || !appOriginReady(requestOrigin)) return fail("Configure APP_ORIGIN as an HTTP(S) origin without a path, or use a valid request origin", 503, "app_origin_unavailable");
    const body = createSchema.parse(await readJson(request, 16 * 1024));
    const batchId = randomUUID();
    const now = new Date();
    const name = body.name || ("Label batch " + now.toISOString().slice(0, 10) + " " + batchId.slice(0, 6).toUpperCase());
    const labels = [];
    for (let index = 1; index <= body.quantity; index += 1) {
      const id = randomUUID();
      const token = newToken(24);
      const serial = "BX-" + batchId.replaceAll("-", "").slice(0, 16).toUpperCase() + "-" + String(index).padStart(5, "0");
      labels.push({ id, serial, hash: tokenHash(token), cipher: encryptToken(token) });
    }
    const layout = body.layout;
    const result = await withTransaction(async (client) => {
      await client.query("INSERT INTO boxsave.label_batches(id, name, quantity, layout, created_by) VALUES ($1, $2, $3, $4::jsonb, $5)",
        [batchId, name, body.quantity, JSON.stringify(layout), admin.id]);
      await client.query("INSERT INTO boxsave.labels(id, batch_id, serial, token_hash, token_ciphertext) " +
        "SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::text[], $5::text[])", [
        labels.map((label) => label.id), Array(body.quantity).fill(batchId), labels.map((label) => label.serial),
        labels.map((label) => label.hash), labels.map((label) => label.cipher),
      ]);
      await writeAdminAudit(client, { actorId: admin.id, action: "label_batch_generated", targetType: "label_batch", targetId: batchId,
        reason: "Generated " + body.quantity + " labels", after: { id: batchId, name, quantity: body.quantity, layout } });
      const stats = await client.query("SELECT count(b.id) FILTER (WHERE l.disabled_at IS NULL)::int AS \"claimedCount\", " +
        "count(l.id) FILTER (WHERE l.disabled_at IS NOT NULL)::int AS \"disabledCount\", " +
        "count(l.id) FILTER (WHERE l.disabled_at IS NULL AND b.id IS NULL)::int AS \"availableCount\" " +
        "FROM boxsave.labels l LEFT JOIN boxsave.boxes b ON b.label_id = l.id WHERE l.batch_id = $1", [batchId]);
      return stats.rows[0];
    });
    const batch = { id: batchId, name, quantity: body.quantity, claimedCount: result.claimedCount,
      disabledCount: result.disabledCount, availableCount: result.availableCount,
      scanCount: 0, createdAt: now.toISOString(), status: "generated", layout };
    return json({ batch, labelsCreated: labels.length }, { status: 201 });
  } catch (error) {
    if (error?.name === "ZodError") return fail("Choose a quantity from 1 to 5,000 and a valid print layout", 400, "invalid_batch");
    if (error?.message === "QR token encryption key is not configured") return fail("QR export encryption is not configured", 503, "qr_secret_unavailable");
    return errorResponse(error);
  }
}

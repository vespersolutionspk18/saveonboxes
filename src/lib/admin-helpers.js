import QRCode from "qrcode";
import { requireAdmin } from "@/lib/auth.js";
import { tokenEncryptionReady, decryptToken } from "@/lib/label-tokens.js";
import { newId } from "@/lib/security.js";
import { buildLabelUrl, resolveAppOrigin } from "@/lib/app-origin.js";
import { buildStickerSvg } from "@/app/admin/sticker-artwork.js";

export { requireAdmin };
export { tokenEncryptionReady, decryptToken };

export const labelStatusSql = `CASE WHEN l.disabled_at IS NOT NULL THEN 'disabled' WHEN b.id IS NOT NULL THEN 'claimed' ELSE 'available' END`;

export function appOriginReady(requestOrigin) {
  return Boolean(resolveAppOrigin({ configuredOrigin: process.env.APP_ORIGIN, requestOrigin }));
}

export async function writeAdminAudit(client, { actorId, action, targetType, targetId, reason, before = null, after = null }) {
  await client.query(`INSERT INTO boxsave.admin_audit_events(id, actor_admin_id, action, target_type, target_id, reason, before_data, after_data)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
  [newId(), actorId, action, targetType, String(targetId), reason || null, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null]);
}

export function labelUrl(token, requestOrigin) {
  const origin = resolveAppOrigin({ configuredOrigin: process.env.APP_ORIGIN, requestOrigin });
  return buildLabelUrl(token, origin);
}

export async function qrSvg(token, serial, layout = {}, requestOrigin) {
  const source = await QRCode.toString(labelUrl(token, requestOrigin), {
    type: "svg", width: 480, margin: 4, errorCorrectionLevel: "Q",
    color: { dark: "#111111", light: "#ffffff" },
  });
  return buildStickerSvg({ qrSource: source, serial, layout });
}

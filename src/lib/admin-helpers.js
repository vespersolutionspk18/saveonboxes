import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { requireAdmin } from "@/lib/auth.js";
import { tokenEncryptionReady, decryptToken } from "@/lib/label-tokens.js";
import { newId } from "@/lib/security.js";
import { buildLabelUrl, resolveAppOrigin } from "@/lib/app-origin.js";

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
  const width = Number(layout.cardWidthMm || 85.6);
  const height = Number(layout.cardHeightMm || 54);
  const qrSize = Math.min(24, height - 18, width * 0.33);
  const qrX = 6;
  const qrY = (height - qrSize) / 2;
  const source = await QRCode.toString(labelUrl(token, requestOrigin), {
    type: "svg", width: 480, margin: 4, errorCorrectionLevel: "Q",
    color: { dark: "#111111", light: "#ffffff" },
  });
  const viewBox = source.match(/viewBox="([^"]+)"/)?.[1] || "0 0 41 41";
  const contents = source.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1] || "";
  const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const mm = (value) => `${Number(value).toFixed(2)}mm`;
  const serialLine = layout.includeSerial === false ? "" : `<text x="${mm(qrX + qrSize + 5)}" y="${mm(18)}" font-family="Arial,sans-serif" font-size="3.1" font-weight="700" fill="#202020">${esc(serial)}</text>`;
  const writeLine = layout.includeWriteFields === false ? "" : `<text x="${mm(qrX + qrSize + 5)}" y="${mm(29)}" font-family="Arial,sans-serif" font-size="2.9" fill="#303030">BOX NO. __________________</text><text x="${mm(qrX + qrSize + 5)}" y="${mm(38)}" font-family="Arial,sans-serif" font-size="2.9" fill="#303030">ROOM ___________________</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${mm(width)}" height="${mm(height)}" viewBox="0 0 ${width * 3.779527559} ${height * 3.779527559}"><rect width="100%" height="100%" fill="#fff"/><svg x="${qrX * 3.779527559}" y="${qrY * 3.779527559}" width="${qrSize * 3.779527559}" height="${qrSize * 3.779527559}" viewBox="${viewBox}" shape-rendering="crispEdges">${contents}</svg><text x="${(qrX + 1) * 3.779527559}" y="${(height - 3) * 3.779527559}" font-family="Arial,sans-serif" font-size="10" fill="#444">SCRATCH TO REVEAL</text>${serialLine.replace(/x="([\d.]+)mm" y="([\d.]+)mm"/g, (_, x, y) => `x="${Number.parseFloat(x) * 3.779527559}" y="${Number.parseFloat(y) * 3.779527559}"`).replace(/font-size="([\d.]+)"/g, (_, size) => `font-size="${Number.parseFloat(size) * 3.779527559}"`)}${writeLine.replace(/x="([\d.]+)mm" y="([\d.]+)mm"/g, (_, x, y) => `x="${Number.parseFloat(x) * 3.779527559}" y="${Number.parseFloat(y) * 3.779527559}"`).replace(/font-size="([\d.]+)"/g, (_, size) => `font-size="${Number.parseFloat(size) * 3.779527559}"`)}</svg>`;
}

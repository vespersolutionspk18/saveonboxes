import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import JSZip from "jszip";
import { requireAdmin, decryptToken, tokenEncryptionReady, appOriginReady, labelUrl, qrSvg } from "@/lib/admin-helpers.js";
import { query } from "@/lib/db.js";
import { errorResponse, fail } from "@/lib/http.js";
import { getRequestOrigin } from "@/lib/app-origin.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const mmToPt = (mm) => mm * 72 / 25.4;
const csvCell = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"';

async function renderPdf(labels, layout, requestOrigin) {
  const cardWidthMm = Number(layout.cardWidthMm || 85.6);
  const cardHeightMm = Number(layout.cardHeightMm || 54);
  const width = mmToPt(cardWidthMm);
  const height = mmToPt(cardHeightMm);
  const doc = await PDFDocument.create();
  doc.setTitle("BoxSave label batch");
  doc.setSubject("Scratch to reveal QR box labels");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const label of labels) {
    const page = doc.addPage([width, height]);
    const qrPng = await QRCode.toBuffer(labelUrl(label.token, requestOrigin), { type: "png", width: 768, margin: 4, errorCorrectionLevel: "Q" });
    const image = await doc.embedPng(qrPng);
    const qr = mmToPt(Math.min(24, cardHeightMm - 18, cardWidthMm * 0.33));
    const x = mmToPt(6);
    const y = (height - qr) / 2 + mmToPt(2);
    page.drawImage(image, { x, y, width: qr, height: qr });
    page.drawText("SCRATCH TO REVEAL", { x: mmToPt(7), y: mmToPt(3.4), size: 6.5, font: regular, color: rgb(0.25, 0.25, 0.25) });
    const textX = x + qr + mmToPt(5);
    if (layout.includeSerial !== false) page.drawText(label.serial, { x: textX, y: height - mmToPt(16), size: 8, font: bold, color: rgb(0.08, 0.08, 0.08) });
    if (layout.includeWriteFields !== false) {
      page.drawText("BOX NO. __________________", { x: textX, y: height - mmToPt(27), size: 7, font: regular, color: rgb(0.18, 0.18, 0.18) });
      page.drawText("ROOM ____________________", { x: textX, y: height - mmToPt(37), size: 7, font: regular, color: rgb(0.18, 0.18, 0.18) });
    }
  }
  return Buffer.from(await doc.save());
}

function attachment(body, type, filename, range) {
  return new Response(body, { status: 200, headers: {
    "content-type": type,
    "content-disposition": 'attachment; filename="' + filename + '"',
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-export-offset": String(range.offset),
    "x-export-count": String(range.count),
    "x-export-total": String(range.total),
  } });
}

export async function GET(request, context) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    if (!tokenEncryptionReady()) return fail("QR export encryption is not configured", 503, "qr_secret_unavailable");
    const requestOrigin = getRequestOrigin(request);
    if (!requestOrigin || !appOriginReady(requestOrigin)) return fail("Configure APP_ORIGIN as an HTTP(S) origin without a path, or use a valid request origin", 503, "app_origin_unavailable");
    const { id } = await context.params;
    const params = new URL(request.url).searchParams;
    const format = params.get("format") || "pdf";
    if (!["pdf", "svg", "zip"].includes(format)) return fail("Choose pdf, svg, or zip format", 400, "invalid_format");
    const batchResult = await query("SELECT id, name, quantity, layout FROM boxsave.label_batches WHERE id = $1", [id]);
    if (!batchResult.rowCount) return fail("Batch not found", 404, "batch_not_found");
    const batch = batchResult.rows[0];
    const total = Number(batch.quantity);
    const offset = Math.max(0, Number.parseInt(params.get("offset") || "0", 10) || 0);
    const requestedLimit = Number.parseInt(params.get("limit") || "500", 10) || 500;
    if (requestedLimit > 500) return fail("Each export is limited to 500 labels; request the next offset for the following part", 413, "export_part_too_large");
    const limit = Math.max(1, requestedLimit);
    if (offset >= total) return fail("Export offset is outside this batch", 400, "invalid_export_range");
    const data = await query("SELECT serial, token_ciphertext AS cipher FROM boxsave.labels WHERE batch_id = $1 ORDER BY serial LIMIT $2 OFFSET $3", [id, limit, offset]);
    const layout = batch.layout || {};
    const labels = data.rows.map((row) => ({ serial: row.serial, token: decryptToken(row.cipher) }));
    const stem = "boxsave-batch-" + id;
    const range = { offset, count: labels.length, total };
    const part = "-" + String(offset + 1).padStart(6, "0") + "-" + String(offset + labels.length).padStart(6, "0");
    if (format === "pdf") return attachment(await renderPdf(labels, layout, requestOrigin), "application/pdf", stem + part + ".pdf", range);

    const zip = new JSZip();
    const svgFolder = zip.folder("svg");
    const rows = ["serial,batchId,status,cardWidthMm,cardHeightMm,artworkFile"];
    for (const label of labels) {
      const svg = await qrSvg(label.token, label.serial, layout, requestOrigin);
      svgFolder.file(label.serial + ".svg", svg);
      rows.push([label.serial, id, "issued", layout.cardWidthMm || 85.6, layout.cardHeightMm || 54,
        "svg/" + label.serial + ".svg"].map(csvCell).join(","));
    }
    zip.file("manifest.csv", rows.join("\n") + "\n");
    zip.file("layout.json", JSON.stringify({ batchId: id, name: batch.name, offset, count: labels.length, total,
      cardWidthMm: layout.cardWidthMm || 85.6, cardHeightMm: layout.cardHeightMm || 54 }, null, 2));
    if (format === "zip") zip.folder("pdf").file("batch" + part + ".pdf", await renderPdf(labels, layout, requestOrigin));
    const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
    return attachment(bytes, "application/zip", stem + part + (format === "svg" ? "-svg" : "") + ".zip", range);
  } catch (error) {
    if (error?.message === "QR token encryption key is not configured") return fail("QR export encryption is not configured", 503, "qr_secret_unavailable");
    if (error?.message === "Application origin is not configured or invalid") return fail("Configure APP_ORIGIN as an HTTP(S) origin without a path, or use a valid request origin", 503, "app_origin_unavailable");
    return errorResponse(error);
  }
}

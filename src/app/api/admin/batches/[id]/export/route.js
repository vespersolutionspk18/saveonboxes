import { PDFDocument, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import JSZip from "jszip";
import { requireAdmin, decryptToken, tokenEncryptionReady, appOriginReady, labelUrl, qrSvg } from "@/lib/admin-helpers.js";
import { drawStickerPdfPage, stickerGeometry } from "@/app/admin/sticker-artwork.js";
import { query } from "@/lib/db.js";
import { errorResponse, fail } from "@/lib/http.js";
import { getRequestOrigin } from "@/lib/app-origin.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const csvCell = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"';

async function renderPdf(labels, layout, requestOrigin) {
  const geometry = stickerGeometry(layout);
  const width = geometry.widthMm * 72 / 25.4;
  const height = geometry.heightMm * 72 / 25.4;
  const doc = await PDFDocument.create();
  const firstSerial = labels[0]?.serial;
  const lastSerial = labels[labels.length - 1]?.serial;
  doc.setTitle(firstSerial ? `BoxSave QR labels ${firstSerial}-${lastSerial}` : "BoxSave QR labels");
  doc.setSubject("Scratch to reveal QR box labels");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const label of labels) {
    const page = doc.addPage([width, height]);
    const qrPng = await QRCode.toBuffer(labelUrl(label.token, requestOrigin), { type: "png", width: 768, margin: 4, errorCorrectionLevel: "Q" });
    const image = await doc.embedPng(qrPng);
    drawStickerPdfPage(page, { image, serial: label.serial, layout, fonts: { regular, bold } });
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
    const data = await query("SELECT short_serial AS serial, serial AS legacy_serial, token_ciphertext AS cipher FROM boxsave.labels WHERE batch_id = $1 ORDER BY serial LIMIT $2 OFFSET $3", [id, limit, offset]);
    const layout = batch.layout || {};
    const labels = data.rows.map((row) => ({ serial: row.serial, legacySerial: row.legacy_serial, token: decryptToken(row.cipher) }));
    if (!labels.length) return fail("No labels were found in this batch export range", 404, "batch_labels_not_found");
    const serialRange = labels.length === 1 ? labels[0].serial : `${labels[0].serial}-${labels[labels.length - 1].serial}`;
    const stem = `boxsave-batch-${id}-${serialRange}`;
    const range = { offset, count: labels.length, total };
    const part = "-" + String(offset + 1).padStart(6, "0") + "-" + String(offset + labels.length).padStart(6, "0");
    if (format === "pdf") return attachment(await renderPdf(labels, layout, requestOrigin), "application/pdf", stem + part + ".pdf", range);

    const zip = new JSZip();
    const svgFolder = zip.folder("svg");
    const rows = ["serial,legacySerial,batchId,status,cardWidthMm,cardHeightMm,artworkFile"];
    for (const label of labels) {
      const svg = await qrSvg(label.token, label.serial, layout, requestOrigin);
      svgFolder.file(label.serial + ".svg", svg);
      rows.push([label.serial, label.legacySerial, id, "issued", layout.cardWidthMm || 85.6, layout.cardHeightMm || 54,
        "svg/" + label.serial + ".svg"].map(csvCell).join(","));
    }
    zip.file("manifest.csv", rows.join("\n") + "\n");
    zip.file("layout.json", JSON.stringify({ batchId: id, name: batch.name, offset, count: labels.length, total,
      firstSerial: labels[0].serial, lastSerial: labels[labels.length - 1].serial,
      cardWidthMm: layout.cardWidthMm || 85.6, cardHeightMm: layout.cardHeightMm || 54,
      serialPrinted: true, includeWriteFields: layout.includeWriteFields !== false }, null, 2));
    if (format === "zip") zip.folder("pdf").file(`batch-${serialRange}${part}.pdf`, await renderPdf(labels, layout, requestOrigin));
    const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
    return attachment(bytes, "application/zip", stem + part + (format === "svg" ? "-svg" : "") + ".zip", range);
  } catch (error) {
    if (error?.message === "QR token encryption key is not configured") return fail("QR export encryption is not configured", 503, "qr_secret_unavailable");
    if (error?.message === "Application origin is not configured or invalid") return fail("Configure APP_ORIGIN as an HTTP(S) origin without a path, or use a valid request origin", 503, "app_origin_unavailable");
    return errorResponse(error);
  }
}

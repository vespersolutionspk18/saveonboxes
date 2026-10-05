import { rgb } from "pdf-lib";

const PX_PER_MM = 96 / 25.4;
const PT_PER_MM = 72 / 25.4;

const mm = (value) => Number(value) * PT_PER_MM;
const svgNumber = (value) => Number(value).toFixed(2);
const escapeXml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

export function stickerGeometry(layout = {}) {
  const widthMm = Number(layout.cardWidthMm) || 85.6;
  const heightMm = Number(layout.cardHeightMm) || 54;
  const qrSizeMm = Math.min(24, heightMm - 18, widthMm * 0.33);
  const qrXmm = 6;
  const qrYmm = (heightMm - qrSizeMm) / 2;
  const textXmm = qrXmm + qrSizeMm + 5;
  return {
    widthMm,
    heightMm,
    qrSizeMm,
    qrXmm,
    qrYmm,
    textXmm,
    serialLabelYmm: qrYmm + 2,
    serialYmm: qrYmm + 10,
    nameYmm: qrYmm + qrSizeMm - 2,
    roomYmm: Math.min(heightMm - 7, qrYmm + qrSizeMm + 7),
    footerYmm: heightMm - 2.5,
    writeFields: layout.includeWriteFields !== false,
  };
}

export function buildStickerSvg({ qrSource, serial, layout = {} }) {
  const geometry = stickerGeometry(layout);
  const viewBox = qrSource.match(/<svg[^>]*viewBox="([^"]+)"/i)?.[1];
  const qrContents = qrSource.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)?.[1];
  if (!viewBox || qrContents === undefined) throw new Error("Could not read generated QR artwork");

  const px = (value) => Number(value) * PX_PER_MM;
  const serialText = escapeXml(serial);
  const nameLine = geometry.writeFields
    ? `<text x="${px(geometry.textXmm)}" y="${px(geometry.nameYmm)}" font-family="Arial,sans-serif" font-size="${px(2.2)}" fill="#303b43">NAME</text><path d="M ${px(geometry.textXmm + 10)} ${px(geometry.nameYmm + 0.7)} H ${px(geometry.widthMm - 6)}" fill="none" stroke="#748694" stroke-width="1"/>`
    : "";
  const roomLine = geometry.writeFields
    ? `<text x="${px(geometry.textXmm)}" y="${px(geometry.roomYmm)}" font-family="Arial,sans-serif" font-size="${px(2.2)}" fill="#303b43">ROOM</text><path d="M ${px(geometry.textXmm + 10)} ${px(geometry.roomYmm + 0.7)} H ${px(geometry.widthMm - 6)}" fill="none" stroke="#748694" stroke-width="1"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgNumber(geometry.widthMm)}mm" height="${svgNumber(geometry.heightMm)}mm" viewBox="0 0 ${px(geometry.widthMm)} ${px(geometry.heightMm)}"><rect width="100%" height="100%" fill="#fff"/><svg x="${px(geometry.qrXmm)}" y="${px(geometry.qrYmm)}" width="${px(geometry.qrSizeMm)}" height="${px(geometry.qrSizeMm)}" viewBox="${viewBox}" shape-rendering="crispEdges">${qrContents}</svg><text x="${px(geometry.textXmm)}" y="${px(geometry.serialLabelYmm)}" font-family="Arial,sans-serif" font-size="${px(2)}" font-weight="700" letter-spacing="0.08em" fill="#586c7c">SERIAL</text><text x="${px(geometry.textXmm)}" y="${px(geometry.serialYmm)}" font-family="Arial,sans-serif" font-size="${px(7.5)}" font-weight="800" letter-spacing="0.08em" fill="#111820">${serialText}</text>${nameLine}${roomLine}<text x="${px(geometry.qrXmm)}" y="${px(geometry.footerYmm)}" font-family="Arial,sans-serif" font-size="${px(1.9)}" font-weight="700" letter-spacing="0.06em" fill="#303b43">SCRATCH TO REVEAL</text></svg>`;
}

export function drawStickerPdfPage(page, { image, serial, layout = {}, fonts }) {
  const geometry = stickerGeometry(layout);
  const { width, height } = page.getSize();
  const textX = mm(geometry.textXmm);
  const dark = rgb(0.067, 0.094, 0.122);
  const muted = rgb(0.22, 0.27, 0.31);
  const rule = rgb(0.45, 0.53, 0.59);

  page.drawImage(image, {
    x: mm(geometry.qrXmm),
    y: height - mm(geometry.qrYmm + geometry.qrSizeMm),
    width: mm(geometry.qrSizeMm),
    height: mm(geometry.qrSizeMm),
  });
  page.drawText("SERIAL", {
    x: textX,
    y: height - mm(geometry.serialLabelYmm),
    size: mm(2),
    font: fonts.regular,
    color: muted,
    characterSpacing: 0.7,
  });
  page.drawText(String(serial ?? ""), {
    x: textX,
    y: height - mm(geometry.serialYmm),
    size: mm(7.5),
    font: fonts.bold,
    color: dark,
    characterSpacing: 1.1,
  });

  if (geometry.writeFields) {
    for (const [label, yMm] of [["NAME", geometry.nameYmm], ["ROOM", geometry.roomYmm]]) {
      const y = height - mm(yMm);
      page.drawText(label, { x: textX, y, size: mm(2.2), font: fonts.regular, color: muted });
      page.drawLine({
        start: { x: textX + mm(10), y: y + mm(0.25) },
        end: { x: mm(geometry.widthMm - 6), y: y + mm(0.25) },
        thickness: 0.55,
        color: rule,
      });
    }
  }

  page.drawText("SCRATCH TO REVEAL", {
    x: mm(geometry.qrXmm),
    y: mm(geometry.heightMm - geometry.footerYmm - 1.2),
    size: mm(1.9),
    font: fonts.bold,
    color: muted,
    characterSpacing: 0.3,
  });
}

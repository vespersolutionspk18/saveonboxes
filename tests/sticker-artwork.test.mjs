import assert from "node:assert/strict";
import test from "node:test";
import zlib from "node:zlib";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { buildStickerSvg, drawStickerPdfPage, stickerGeometry } from "../src/app/admin/sticker-artwork.js";

const serial = "A7K2";
const sampleUrl = "https://example.test/box/sample-token";

test("SVG sticker always prints its public serial and uses gift-card artwork fields", async () => {
  const qrSource = await QRCode.toString(sampleUrl, { type: "svg", errorCorrectionLevel: "Q" });
  const artwork = buildStickerSvg({ qrSource, serial, layout: { includeSerial: false, includeWriteFields: true } });

  assert.match(artwork, /width="85\.60mm" height="54\.00mm"/);
  assert.match(artwork, /SERIAL/);
  assert.match(artwork, />A7K2<\/text>/);
  assert.match(artwork, />NAME<\/text>/);
  assert.match(artwork, />ROOM<\/text>/);
  assert.doesNotMatch(artwork, /BOX NO\./);
});

test("PDF sticker keeps the serial when the legacy includeSerial flag is false", async () => {
  const geometry = stickerGeometry({ cardWidthMm: 85.6, cardHeightMm: 54, includeSerial: false });
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const png = await QRCode.toBuffer(sampleUrl, { type: "png", width: 256, margin: 4, errorCorrectionLevel: "Q" });
  const qrImage = await document.embedPng(png);
  const page = document.addPage([geometry.widthMm * 72 / 25.4, geometry.heightMm * 72 / 25.4]);

  drawStickerPdfPage(page, { image: qrImage, serial, layout: { includeSerial: false }, fonts: { regular, bold } });
  const bytes = Buffer.from(await document.save({ useObjectStreams: false }));
  const reopened = await PDFDocument.load(bytes);
  const decodedStreams = reopened.context.enumerateIndirectObjects()
    .map(([, object]) => object)
    .filter((object) => object.constructor.name.includes("Stream"))
    .map((object) => {
      const contents = Buffer.from(object.contents || []);
      try { return zlib.inflateSync(contents).toString("latin1"); }
      catch { return contents.toString("latin1"); }
    });
  assert.ok(decodedStreams.some((stream) => stream.includes("<41374B32> Tj")), "the PDF text stream should contain extractable serial glyphs");

  const [savedPage] = reopened.getPages();
  assert.ok(Math.abs(savedPage.getWidth() - (85.6 * 72 / 25.4)) < 0.01);
  assert.ok(Math.abs(savedPage.getHeight() - (54 * 72 / 25.4)) < 0.01);
  assert.ok(decodedStreams.every((stream) => !stream.includes("BOX NO.")));
});

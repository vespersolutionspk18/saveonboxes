#!/usr/bin/env node
/**
 * Download and convert the images for every Uline SKU we collected.
 *
 *   node scripts/uline-fetch-images.mjs                 # everything
 *   node scripts/uline-fetch-images.mjs --shard 0 --of 4
 *
 * Uline's image server resolves any item number directly, so the URL is
 * derived from the SKU rather than scraped. It returns JPEG; we re-encode to
 * WebP to match the rest of the site's assets.
 *
 * Writes public/uline/<sku>.webp
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { fetchBuffer, sleep } from "./lib/uline-fetch.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_DIR = path.join(ROOT, "reports/uline-products");
const OUT_DIR = path.join(ROOT, "public/uline");

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const shard = Number(arg("shard", 0));
const of = Number(arg("of", 1));

/** Every SKU we successfully parsed a product record for. */
function allSkus() {
  const seen = new Map();
  for (const file of fs.readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith(".json"))) {
    const shardData = JSON.parse(fs.readFileSync(path.join(PRODUCTS_DIR, file), "utf8"));
    for (const p of shardData.products || []) if (!seen.has(p.sku)) seen.set(p.sku, p);
  }
  return [...seen.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

const skus = allSkus();
const size = Math.ceil(skus.length / of);
const mine = skus.slice(shard * size, (shard + 1) * size);

fs.mkdirSync(OUT_DIR, { recursive: true });

const IMG = (sku) => `https://img.uline.com/is/image/uline/${sku}?&wid=520&hei=520&qlt=88&op_usm=1,1,1`;

let ok = 0;
let skipped = 0;
let failed = 0;

console.log(`images shard ${shard}-of-${of}: ${mine.length} SKUs`);

for (const product of mine) {
  const dest = path.join(OUT_DIR, `${product.sku}.webp`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    skipped += 1;
    continue;
  }
  try {
    const jpeg = await fetchBuffer(IMG(product.sku), { retries: 5, timeoutMs: 25000 });
    const webp = await sharp(jpeg).resize(520, 520, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
    fs.writeFileSync(dest, webp);
    ok += 1;
  } catch (err) {
    failed += 1;
    console.log(`  FAIL ${product.sku}: ${err.message.slice(0, 90)}`);
  }
  await sleep(60);
}

console.log(`images shard ${shard}-of-${of}: new=${ok} skipped=${skipped} failed=${failed}`);

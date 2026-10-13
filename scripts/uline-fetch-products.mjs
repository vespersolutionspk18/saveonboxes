#!/usr/bin/env node
/**
 * Fetch full Uline product records for one shard of the SKU universe.
 *
 *   node scripts/uline-fetch-products.mjs --shard 0 --of 10
 *   node scripts/uline-fetch-products.mjs --shard 0 --of 10 --only moving-boxes
 *
 * Reads   reports/uline-skus.json      (produced by uline-enumerate.mjs)
 * Writes  reports/uline-products/shard-<n>-of-<m>.json
 *
 * The output file is rewritten after every product, so a run that dies part way
 * through can simply be started again and it will skip what it already has.
 * That matters here because the only network route to Uline is a flaky proxy.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchText, sleep } from "./lib/uline-fetch.mjs";
import { parseProductPage, parseProductPageFallback } from "./lib/uline-product.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKUS = path.join(ROOT, "reports/uline-skus.json");
const OUT_DIR = path.join(ROOT, "reports/uline-products");

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const shard = Number(arg("shard", 0));
const of = Number(arg("of", 1));
const onlyCategory = arg("only");
const label = arg("label", `${shard}-of-${of}`);

const universe = JSON.parse(fs.readFileSync(SKUS, "utf8"));
let entries = universe.skus;
if (onlyCategory) entries = entries.filter((e) => e.categories.includes(onlyCategory));

// Contiguous slices, so each shard is a coherent run of families rather than a
// scattered sample — easier to eyeball when something looks wrong.
const size = Math.ceil(entries.length / of);
const mine = entries.slice(shard * size, (shard + 1) * size);

const outFile = path.join(OUT_DIR, `shard-${label}.json`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const state = fs.existsSync(outFile)
  ? JSON.parse(fs.readFileSync(outFile, "utf8"))
  : { shard, of, label, startedAt: new Date().toISOString(), products: [], failed: [] };

const done = new Set(state.products.map((p) => p.sku));
const failedBefore = new Map(state.failed.map((f) => [f.sku, f]));

const save = () => fs.writeFileSync(outFile, JSON.stringify(state, null, 2) + "\n");

const productUrl = (sku) => `https://www.uline.com/Product/Detail/${sku}`;

console.log(`shard ${label}: ${mine.length} SKUs (${done.size} already done)`);

for (const entry of mine) {
  if (done.has(entry.sku)) continue;

  try {
    const html = await fetchText(productUrl(entry.sku), { retries: 8, timeoutMs: 30000 });
    // Most pages carry the schema.org block; a few (Round Trip Totes) do not,
    // so fall back to scraping the item description and hierarchy ids.
    const record = parseProductPage(html, { sku: entry.sku })
      || parseProductPageFallback(html, { sku: entry.sku });
    if (!record) throw new Error("no product data on page");

    state.products.push({
      ...record,
      // Which of our 15 categories this SKU was reached through, and which
      // family page listed it.
      categories: entry.categories,
      familyUrl: entry.familyUrl,
      familyTitle: entry.familyTitle,
    });
    done.add(entry.sku);
    failedBefore.delete(entry.sku);
    state.failed = [...failedBefore.values()];
    console.log(`  ok  ${entry.sku}  ${record.name.slice(0, 62)}`);
  } catch (err) {
    failedBefore.set(entry.sku, { sku: entry.sku, error: err.message.slice(0, 160) });
    state.failed = [...failedBefore.values()];
    console.log(`  FAIL ${entry.sku}  ${err.message.slice(0, 90)}`);
  }

  state.updatedAt = new Date().toISOString();
  save();
  await sleep(120); // be gentle with the proxy
}

save();
console.log(`shard ${label}: done=${state.products.length} failed=${state.failed.length} -> ${path.relative(ROOT, outFile)}`);

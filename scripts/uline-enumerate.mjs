#!/usr/bin/env node
/**
 * Enumerate every Uline SKU reachable from our 15 category pages.
 *
 * Uline's structure, as far as this crawl needs to care:
 *
 *   Grp_*   a group hub  -> links out to several BL_* browse pages
 *   BL_*    a browse page -> a <table class="subgroupChart"> of SKUs
 *   S-*     one SKU = one variant, with its own price and dimensions
 *
 * A BL_* page is the "product family"; the SKUs on it are its variants.
 *
 * Writes reports/uline-skus.json
 *   { categories: { <slug>: { source, families: [ { url, skus: [...] } ] } },
 *     skus: [ { sku, categories: [...], familyUrl, familyTitle } ] }
 *
 *   node scripts/uline-enumerate.mjs            # all categories
 *   node scripts/uline-enumerate.mjs moving-boxes golf
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchText } from "./lib/uline-fetch.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "src/app/category-data");
const OUT = path.join(ROOT, "reports/uline-skus.json");

const only = process.argv.slice(2);

const abs = (href) => (href.startsWith("http") ? href : `https://www.uline.com${href}`);
const BL = /\/BL_(\d+)\//i;
const GRP = /\/Grp_[A-Za-z0-9]+\//i;

const familyTitle = (html) => {
  const m = html.match(/<title>([^<]*)/);
  return m ? m[1].replace(/\s*[-|]\s*ULINE.*$/i, "").trim() : null;
};

/** Every SKU that appears in a product-table row. */
function skusIn(html) {
  const tables = [...html.matchAll(/<table[^>]*class="subgroupChart"[\s\S]*?<\/table>/g)].map((m) => m[0]);
  const scope = tables.length ? tables : [html];
  const found = new Set();
  for (const t of scope) {
    for (const m of t.matchAll(/\/Product\/Detail\/(S-\d+)\//g)) found.add(m[1]);
  }
  // Fall back to the whole document if the tables yielded nothing usable.
  if (!found.size) for (const m of html.matchAll(/\/Product\/Detail\/(S-\d+)\//g)) found.add(m[1]);
  return [...found];
}

/** Links to browse pages / group hubs embedded in a page. */
function linksIn(html) {
  const bl = new Set();
  const grp = new Set();
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (BL.test(href)) bl.add(abs(href).split("?")[0]);
    else if (GRP.test(href)) grp.add(abs(href).split("?")[0]);
  }
  return { bl: [...bl], grp: [...grp] };
}

const loadCategory = (slug) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${slug}.json`), "utf8"));

const slugs = fs
  .readdirSync(DATA_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .filter((s) => !only.length || only.includes(s))
  .sort();

const result = { generatedAt: new Date().toISOString(), categories: {}, skus: [] };

// When re-running a subset, start from what is already on disk so a partial
// re-run repairs the missing categories instead of replacing the whole file.
if (only.length && fs.existsSync(OUT)) {
  const previous = JSON.parse(fs.readFileSync(OUT, "utf8"));
  for (const [slug, cat] of Object.entries(previous.categories || {})) {
    if (!only.includes(slug)) result.categories[slug] = cat;
  }
}

const skuIndex = new Map();

// Re-seed the SKU index from any categories carried over above, so the final
// `skus` list stays a complete picture of the universe.
for (const [slug, cat] of Object.entries(result.categories)) {
  for (const family of cat.families || []) {
    for (const sku of family.skus || []) {
      let entry = skuIndex.get(sku);
      if (!entry) {
        entry = { sku, categories: [], familyUrl: family.url, familyTitle: family.title };
        skuIndex.set(sku, entry);
      }
      if (!entry.categories.includes(slug)) entry.categories.push(slug);
    }
  }
}

/** Record a family (one BL_ page) against a category and harvest its SKUs. */
function recordFamily(slug, url, title, skus) {
  const cat = (result.categories[slug] ||= { source: null, families: [] });
  cat.families.push({ url, title, skus });
  for (const sku of skus) {
    let entry = skuIndex.get(sku);
    if (!entry) {
      entry = { sku, categories: [], familyUrl: url, familyTitle: title };
      skuIndex.set(sku, entry);
    }
    if (!entry.categories.includes(slug)) entry.categories.push(slug);
  }
}

for (const slug of slugs) {
  const page = loadCategory(slug);
  const source = abs(page.source);
  result.categories[slug] = { source, families: [] };

  // Seed browse pages: whatever the category page already links to, plus any
  // explicit product links, plus the source itself when it is a BL_ page.
  const blSeeds = new Set();
  const grpSeeds = new Set();
  if (BL.test(source)) blSeeds.add(source);
  if (GRP.test(source)) grpSeeds.add(source);
  for (const card of [...(page.featured || []), ...(page.items || [])]) {
    if (!card.href) continue;
    const href = abs(card.href);
    if (BL.test(href)) blSeeds.add(href.split("?")[0]);
    else if (GRP.test(href)) grpSeeds.add(href.split("?")[0]);
  }

  // Walk the group hubs to pick up every browse page they list. Group pages can
  // nest, so this is a worklist rather than a single pass.
  const grpQueue = [...grpSeeds];
  const grpSeen = new Set(grpQueue);
  while (grpQueue.length) {
    const grp = grpQueue.shift();
    try {
      const html = await fetchText(grp);
      const { bl, grp: more } = linksIn(html);
      bl.forEach((u) => blSeeds.add(u));
      for (const u of more) {
        if (!grpSeen.has(u)) {
          grpSeen.add(u);
          grpQueue.push(u);
        }
      }
    } catch (err) {
      console.warn(`  ! group ${grp}: ${err.message.slice(0, 80)}`);
    }
  }

  const seenFamily = new Set();
  for (const url of [...blSeeds]) {
    if (seenFamily.has(url)) continue;
    seenFamily.add(url);
    try {
      const html = await fetchText(url);
      const skus = skusIn(html);
      if (skus.length) recordFamily(slug, url, familyTitle(html), skus);
      else console.log(`  . ${slug}: no SKUs on ${url}`);
    } catch (err) {
      console.warn(`  ! ${slug} ${url}: ${err.message.slice(0, 80)}`);
    }
  }

  const cat = result.categories[slug];
  const catSkus = new Set(cat.families.flatMap((f) => f.skus));
  console.log(
    `${slug.padEnd(24)} families ${String(cat.families.length).padStart(3)}  SKUs ${String(catSkus.size).padStart(4)}`,
  );
}

result.skus = [...skuIndex.values()].sort((a, b) => a.sku.localeCompare(b.sku));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");

console.log("");
console.log(`total families: ${Object.values(result.categories).reduce((n, c) => n + c.families.length, 0)}`);
console.log(`total unique SKUs: ${result.skus.length}`);
console.log(`written: ${path.relative(ROOT, OUT)}`);

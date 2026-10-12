/**
 * Remove products that fit none of the 15 Uline-derived categories.
 *
 * Backs the catalogue up before writing, and reports which storefront sections
 * lose all their products as a result.
 *
 * Usage: node scripts/prune-catalog.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { typeOfRecord } from "./lib/taxonomy.mjs";
import { fitOf, categoryOf, CATEGORIES } from "./lib/categories.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = path.join(ROOT, "src/app/supplier-catalog.json");
const BACKUP = path.join(ROOT, "reports/supplier-catalog.backup.json");

const dryRun = process.argv.includes("--dry-run");

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));

/* ------------------------------------------------------------------ *
 * Diagnostic: mirror of supplyCategoryFor() in src/app/supplier-products.js
 * so we can warn about storefront sections that would go empty.
 * ------------------------------------------------------------------ */
const SUPPLY_SECTIONS = {
  "cargo-control": "Cargo control",
  "moving-equipment": "Moving equipment",
  "reusable-storage": "Reusable storage & crates",
  "safety-security": "Safety & security",
  "furniture-protection": "Furniture & floor protection",
  "packing-materials": "Packing materials",
  "other-moving-supplies": "Other moving supplies",
};

function supplySectionFor(record) {
  const text = `${record.category} ${record.additional_categories} ${record.product} ${record.details}`.toLowerCase();
  if (/cargo|tie.down|strap|winch|separator net|\bnet\b|sling|shoring|load bar|logistic track|\brope\b|fastener/.test(text)) return "cargo-control";
  if (/hand truck|dolly|dollies|pallet jack|pallet truck|\bcart\b|\bcarts\b|ramp|walkboard|piano moving|furniture skate|turn plate|ladder|machine moving/.test(text)) return "moving-equipment";
  if (/crate|vault|\btote\b|\bbins?\b|e-crate|moving container/.test(text)) return "reusable-storage";
  if (/safety|\bppe\b|glove|gloves|\block\b|locks|security/.test(text)) return "safety-security";
  if (/furniture|mattress|sofa|cover|pad|blanket|floor|carpet|scuff|shield|runner|door protector|banister/.test(text)) return "furniture-protection";
  if (/tape|bubble|stretch wrap|newsprint|paper|wadding|cushion|microfoam|peanuts|rubber band|label|seal|packaging/.test(text)) return "packing-materials";
  return "other-moving-supplies";
}

function isBoxRecord(record) {
  const primary = String(record.category || "").trim().toLowerCase();
  const text = `${primary} ${record.product}`.toLowerCase();
  return primary.startsWith("boxes >") || /\b(carton|cartons|box|boxes|wardrobe carton|mirror carton|mattress carton|pak.n.move kit)\b/.test(text);
}

/* ------------------------------------------------------------------ *
 * Split
 * ------------------------------------------------------------------ */

const kept = {};
const removed = [];

for (const [supplier, list] of Object.entries(catalog)) {
  kept[supplier] = [];
  for (const record of list) {
    const type = typeOfRecord(record);
    if (fitOf(type) === "none") {
      removed.push({ supplier, type, category: record.category, name: record.product, sku: record.sku });
    } else {
      kept[supplier].push(record);
    }
  }
}

const totalBefore = Object.values(catalog).reduce((n, l) => n + l.length, 0);
const totalAfter = Object.values(kept).reduce((n, l) => n + l.length, 0);

/* ------------------------------------------------------------------ *
 * Storefront impact
 * ------------------------------------------------------------------ */

const sectionBefore = {};
const sectionAfter = {};
for (const [supplier, list] of Object.entries(catalog)) {
  for (const record of list) {
    if (isBoxRecord(record)) continue;
    sectionBefore[supplySectionFor(record)] = (sectionBefore[supplySectionFor(record)] || 0) + 1;
  }
}
for (const list of Object.values(kept)) {
  for (const record of list) {
    if (isBoxRecord(record)) continue;
    sectionAfter[supplySectionFor(record)] = (sectionAfter[supplySectionFor(record)] || 0) + 1;
  }
}

/* ------------------------------------------------------------------ *
 * Write
 * ------------------------------------------------------------------ */

if (!dryRun) {
  fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
  fs.copyFileSync(CATALOG, BACKUP);
  fs.writeFileSync(CATALOG, `${JSON.stringify(kept, null, 2)}\n`);
}

console.log(dryRun ? "=== DRY RUN — nothing written ===" : "=== PRUNED ===");
console.log(`products: ${totalBefore} -> ${totalAfter}  (removed ${removed.length})`);
for (const [supplier, list] of Object.entries(kept)) {
  console.log(`  ${supplier.padEnd(10)} ${catalog[supplier].length} -> ${list.length}`);
}
if (!dryRun) console.log(`backup: ${path.relative(ROOT, BACKUP)}`);

console.log("\n=== removed by type ===");
const byType = {};
for (const r of removed) byType[r.type] = (byType[r.type] || 0) + 1;
Object.entries(byType).sort((a, b) => b[1] - a[1])
  .forEach(([t, n]) => console.log(`  ${t.padEnd(20)} ${n}`));

console.log("\n=== storefront supply sections ===");
for (const id of Object.keys(SUPPLY_SECTIONS)) {
  const before = sectionBefore[id] || 0;
  const after = sectionAfter[id] || 0;
  const flag = after === 0 ? "  <-- EMPTY" : "";
  console.log(`  ${SUPPLY_SECTIONS[id].padEnd(28)} ${String(before).padStart(3)} -> ${String(after).padStart(3)}${flag}`);
}

console.log("\n=== remaining products per category page ===");
const perCat = {};
for (const list of Object.values(kept)) {
  for (const record of list) {
    const slug = categoryOf(typeOfRecord(record));
    if (slug) perCat[slug] = (perCat[slug] || 0) + 1;
  }
}
for (const slug of Object.keys(CATEGORIES)) {
  const n = perCat[slug] || 0;
  console.log(`  ${CATEGORIES[slug].padEnd(34)} ${String(n).padStart(3)}${n === 0 ? "  <-- EMPTY" : ""}`);
}

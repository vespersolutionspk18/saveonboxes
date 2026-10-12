/**
 * Cross-reference Uline's scraped category products against our own supplier
 * catalogue (New Haven + CDS).
 *
 * Model: a product is identified by what it *is* (canonical type) plus its
 * physical size. Type is the unit of comparison — "do we carry this product?" —
 * and dimensions refine it within a type.
 *
 * Usage: node scripts/cross-reference.mjs
 * Writes: reports/product-cross-reference.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dimsOf, dimLabel, sameSize, sizeDistance, typeOf, typeOfRecord } from "./lib/taxonomy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

/* ------------------------------------------------------------------ *
 * Load both sides
 * ------------------------------------------------------------------ */

const ULINE_FILES = [
  "artwork-mirror", "bike", "bulk-cargo-containers", "dish-and-glass", "golf",
  "lamp", "mattress", "moving-blankets", "moving-boxes", "moving-kits",
  "packing-supplies", "round-trip-totes", "storage-file", "tv-boxes", "wardrobe",
];

function loadUline() {
  const out = [];
  for (const slug of ULINE_FILES) {
    const page = read(`src/app/category-data/${slug}.json`);
    const rows = [
      ...(page.featured || []).map((c) => ({ ...c, tier: "featured" })),
      ...(page.items || []).map((c) => ({ ...c, tier: "item" })),
    ];
    for (const row of rows) {
      out.push({
        slug,
        categoryTitle: page.title,
        sku: row.sku || null,
        name: row.name,
        tier: row.tier,
        kind: row.sku ? "product" : "subcategory",
        type: typeOf(row.name),
        dims: dimsOf(row.name),
      });
    }
  }
  return out;
}

function loadOurs() {
  const catalog = read("src/app/supplier-catalog.json");
  const out = [];
  for (const [key, list] of Object.entries(catalog)) {
    for (const p of list) {
      const blob = [p.category, p.additional_categories, p.product, p.details, p.variants]
        .filter(Boolean).join(" ");
      // Classify on the product name first — category labels are noisy
      // ("Speed pack/commercial bins" would otherwise make a Gaylord box a
      // speed pack). Fall back to the category when the name says nothing.
      out.push({
        supplier: key,
        company: p.company,
        category: p.category,
        sku: p.sku,
        name: p.product,
        price: p.price,
        url: p.url,
        type: typeOfRecord(p),
        dims: dimsOf(blob),
      });
    }
  }
  return out;
}

const ulineRaw = loadUline();
const ours = loadOurs();

// Collapse duplicate Uline rows (same SKU listed in several categories).
const ulineMap = new Map();
for (const u of ulineRaw) {
  const key = u.sku ? `sku:${u.sku}` : `name:${u.name.toLowerCase()}`;
  if (!ulineMap.has(key)) ulineMap.set(key, { ...u, alsoIn: [] });
  else ulineMap.get(key).alsoIn.push(u.slug);
}
const uline = [...ulineMap.values()];

/**
 * Types where we carry something in the same family but not the same product.
 * These are flagged so the report does not claim an equivalence we don't have.
 */
const LOOSE_TYPES = {
  "round-trip-tote": "Our reusable containers are the E-Crate polypropylene file system, not stackable plastic moving totes. Same family, different product.",
  "bulk-container": "We carry one tapered bulk bin plus corrugated sheets; Uline's line is triple-wall boxes, gaylord pallet boxes and octagon bins.",
  "dolly": "Ours are carton dollies for moving; Uline's entry here is a hardwood furniture dolly.",
  "generic-box": "Plain corrugated cartons on both sides — comparable by size only, no branded equivalent.",
  "paper-pad": "Our pads are pallet/furniture pads; Uline's are paper moving pads for wrapping.",
  "foam": "We stock foam sheets and microfoam; Uline's entry is a foam dispenser box.",
};

/* ------------------------------------------------------------------ *
 * Compare
 * ------------------------------------------------------------------ */

const ourByType = new Map();
for (const o of ours) {
  if (!ourByType.has(o.type)) ourByType.set(o.type, []);
  ourByType.get(o.type).push(o);
}

const matched = [];
const ulineOnly = [];

for (const u of uline) {
  // "unclassified" is a bucket, not a product type — it must never match.
  const pool = u.type === "unclassified" ? [] : (ourByType.get(u.type) || []);
  if (!pool.length) {
    ulineOnly.push(u);
    continue;
  }

  const sized = pool.filter((o) => o.dims);
  const exact = u.dims ? pool.filter((o) => sameSize(o.dims, u.dims)) : [];
  // Nearest by size first, so the report shows the most comparable item.
  const ranked = [...pool].sort((a, b) => sizeDistance(a.dims, u.dims) - sizeDistance(b.dims, u.dims));

  matched.push({
    uline: {
      sku: u.sku, name: u.name, kind: u.kind, tier: u.tier,
      category: u.categoryTitle, alsoIn: u.alsoIn,
      type: u.type, dims: dimLabel(u.dims),
    },
    confidence: exact.length ? "exact-size" : (LOOSE_TYPES[u.type] ? "adjacent" : "same-product"),
    note: LOOSE_TYPES[u.type] || null,
    oursCount: pool.length,
    oursWithSize: sized.length,
    sizeMatches: exact.map((o) => ({ sku: o.sku, name: o.name, company: o.company, dims: dimLabel(o.dims) })),
    nearest: ranked.slice(0, 5).map((o) => ({
      sku: o.sku, name: o.name, company: o.company, category: o.category,
      dims: dimLabel(o.dims), price: o.price,
    })),
  });
}

// Our products whose type Uline never lists are ours-only. "unclassified" is a
// bucket rather than a type, so it must not count as a Uline type here either —
// otherwise our unclassified products silently drop out of both lists.
const ulineTypes = new Set(uline.map((u) => u.type).filter((t) => t !== "unclassified"));
const oursOnly = ours.filter((o) => !ulineTypes.has(o.type));

const group = (list, keyFn) =>
  [...list.reduce((m, x) => {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
    return m;
  }, new Map())].sort((a, b) => b[1].length - a[1].length);

const report = {
  generatedAt: new Date().toISOString(),
  counts: {
    ulineRawRows: ulineRaw.length,
    ulineUnique: uline.length,
    ulineProducts: uline.filter((u) => u.kind === "product").length,
    ulineSubcategories: uline.filter((u) => u.kind === "subcategory").length,
    ulineTypes: ulineTypes.size,
    ours: ours.length,
    oursTypes: ourByType.size,
    matchedUline: matched.length,
    matchedUlineProducts: matched.filter((m) => m.uline.kind === "product").length,
    matchedUlineSubcategories: matched.filter((m) => m.uline.kind === "subcategory").length,
    exactSizeMatches: matched.filter((m) => m.confidence === "exact-size").length,
    ulineOnly: ulineOnly.length,
    oursOnly: oursOnly.length,
  },
  matched,
  ulineOnly: ulineOnly.map((u) => ({
    sku: u.sku, name: u.name, kind: u.kind, tier: u.tier,
    category: u.categoryTitle, type: u.type, dims: dimLabel(u.dims),
  })),
  oursOnly: oursOnly.map((o) => ({
    supplier: o.supplier, company: o.company, category: o.category,
    sku: o.sku, name: o.name, type: o.type, dims: dimLabel(o.dims),
    price: o.price, url: o.url,
  })),
  ourTypeCounts: group(ours, (o) => o.type).map(([t, l]) => [t, l.length]),
  ulineTypeCounts: group(uline, (u) => u.type).map(([t, l]) => [t, l.length]),
};

fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "reports/product-cross-reference.json"),
  JSON.stringify(report, null, 2),
);

console.log(JSON.stringify(report.counts, null, 2));
console.log("\n=== MATCHED (uline type -> how many of ours in that type) ===");
for (const [t, l] of group(matched, (m) => m.uline.type)) {
  console.log(`${t.padEnd(20)} uline ${String(l.length).padStart(3)}  ours ${String(l[0].oursCount).padStart(3)}  exact-size ${l.filter((m) => m.confidence === "exact-size").length}`);
}
console.log("\n=== ULINE-ONLY BY TYPE ===");
for (const [t, l] of group(ulineOnly, (u) => u.type)) console.log(`${t.padEnd(20)} ${l.length}`);
console.log("\n=== OURS-ONLY BY TYPE ===");
for (const [t, l] of group(oursOnly, (o) => o.type)) console.log(`${t.padEnd(20)} ${l.length}`);

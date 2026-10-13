#!/usr/bin/env node
/**
 * Assemble the scraped Uline products into the site's catalogue file.
 *
 *   node scripts/build-uline-catalog.mjs            # write
 *   node scripts/build-uline-catalog.mjs --dry-run  # report only
 *
 * Reads   reports/uline-products/shard-*.json
 * Writes  src/app/supplier-catalog.json   { uline: [ ...one record per SKU ] }
 *
 * Each record keeps the field names the storefront already understands
 * (company / category / product / sku / details / price / availability / url /
 * source / image) and adds a nested `uline` object with everything else Uline
 * publishes: their class-group-subgroup taxonomy, the size triple, colour,
 * bundle pricing and the family page the variant belongs to.
 *
 * A backup of whatever catalogue was there before is written to
 * reports/supplier-catalog.pre-uline.json.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./lib/categories.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_DIR = path.join(ROOT, "reports/uline-products");
const CATALOG = path.join(ROOT, "src/app/supplier-catalog.json");
const BACKUP = path.join(ROOT, "reports/supplier-catalog.pre-uline.json");
const REPORT = path.join(ROOT, "reports/uline-catalog.json");

const dryRun = process.argv.includes("--dry-run");

const CATEGORY_ORDER = Object.keys(CATEGORIES);
const labelOf = (slug) => CATEGORIES[slug] || slug;

/**
 * Which category a product is *primarily* filed under.
 *
 * Picking the first category in list order does not work: almost every box is
 * reachable from the broad "Moving Boxes" browse page, so it would swallow the
 * mattress, wardrobe and kit ranges and leave those sections empty. Instead,
 * score the product's own name and Uline taxonomy against each category and
 * take the best match, using a specificity order to break ties — narrow
 * categories first, the broad catch-alls last.
 */
const CATEGORY_KEYWORDS = {
  "moving-kits": /\b(moving kit|kit\b|bundle)/i,
  mattress: /\b(mattress|bedding)\b/i,
  wardrobe: /\b(wardrobe|garment|hanger|suit shipper)/i,
  "tv-boxes": /\b(tv|flat.?panel|television|monitor|plasma)\b/i,
  "dish-and-glass": /\b(dish|glass|glassware)\b/i,
  lamp: /\blamp\b/i,
  golf: /\b(golf|tall box|tall corrugated|tall)\b/i,
  bike: /\b(bike|bicycle|side.?load)/i,
  "artwork-mirror": /\b(mirror|artwork|picture|frame)\b/i,
  "round-trip-totes": /\b(round trip|tote|keepbox)\b/i,
  "bulk-cargo-containers": /\b(bulk|gaylord|cargo|container|triple wall|octagon|pallet)\b/i,
  "storage-file": /\b(file|storage|record|archive|drawer|bankers|keepbox)\b/i,
  // No leading \b on these two: Uline writes compound words like
  // "Goodwrappers" and "Econo-Wrapper", where the keyword has no word boundary
  // in front of it.
  "packing-supplies": /(tape|wrap|bubble|foam|paper|newsprint|label|corner|knife|dispenser|stretch|wadding|cushion|peanut|marker)/i,
  "moving-blankets": /(blanket|pad\b|cover|dolly|hand truck|strap|tie.?down|winch|sling|\bnet\b|shoring|ramp|carpet|scrim|runner)/i,
  "moving-boxes": /\b(box|carton)/i,
};

const SPECIFICITY = [
  "moving-kits", "mattress", "wardrobe", "tv-boxes", "dish-and-glass", "lamp",
  "golf", "bike", "artwork-mirror", "round-trip-totes", "bulk-cargo-containers",
  "storage-file", "packing-supplies", "moving-blankets", "moving-boxes",
];

function primaryCategory(product) {
  const candidates = (product.categories || []).filter((c) => CATEGORY_KEYWORDS[c]);
  if (!candidates.length) return null;

  const haystack = [
    product.taxonomy?.subgroupDesc,
    product.taxonomy?.groupDesc,
    product.taxonomy?.classDesc,
    product.itemDescription,
    product.name,
  ].filter(Boolean).join(" ");

  // Take every category whose keyword actually appears, then pick the most
  // specific of those. Scoring by match *count* does not work: a broad pattern
  // like /box|carton/ hits four times in "Mattress Boxes / Moving Boxes /
  // Boxes, Corrugated / Twin Size Mattress Boxes" and would out-score the one
  // precise "mattress" hit, filing mattress cartons as plain moving boxes.
  const matching = candidates.filter((slug) => CATEGORY_KEYWORDS[slug].test(haystack));
  // Nothing matched, so the name gives no signal: keep the browse page Uline
  // filed it under first rather than guessing from the specificity order.
  if (!matching.length) return candidates[0];
  return [...matching].sort((a, b) => SPECIFICITY.indexOf(a) - SPECIFICITY.indexOf(b))[0];
}

/* ------------------------------------------------------------------- load */

if (!fs.existsSync(PRODUCTS_DIR)) {
  console.error(`no scraped products at ${path.relative(ROOT, PRODUCTS_DIR)} — run uline-fetch-products.mjs first`);
  process.exit(1);
}

const bySku = new Map();
const shardStats = [];
const failures = [];

for (const file of fs.readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith(".json")).sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(PRODUCTS_DIR, file), "utf8"));
  const before = bySku.size;
  for (const p of data.products || []) if (!bySku.has(p.sku)) bySku.set(p.sku, p);
  for (const f of data.failed || []) failures.push(f);
  shardStats.push({ file, parsed: (data.products || []).length, new: bySku.size - before, failed: (data.failed || []).length });
}

const products = [...bySku.values()];

/* --------------------------------------------------------------- assemble */

const money = (n) => (n == null ? null : `$${n.toFixed(2)}`);

const records = products
  .map((p) => {
    const primary = primaryCategory(p);
    const dims = p.dimensions;
    const dimText = dims ? `${dims.length} × ${dims.width} × ${dims.height}"` : null;

    // Uline's image server 403s ("Unable to find image") for a handful of SKUs.
    // Point those at the shared placeholder rather than shipping a broken link.
    const localImage = path.join(ROOT, "public/uline", `${p.sku}.webp`);
    const hasLocalImage = fs.existsSync(localImage);

    // Display name: Uline's own item description is the cleanest, and the size
    // prefix is already part of it for boxes.
    const name = p.itemDescription || p.name;

    const detailBits = [];
    if (dimText) detailBits.push(dimText);
    if (p.color) detailBits.push(p.color);
    if (p.bundleQty > 1) detailBits.push(`${p.bundleQty} per bundle`);

    return {
      company: "Uline",
      category: primary ? labelOf(primary) : "Uncategorised",
      // The single category this product is filed under, decided here so the
      // storefront never has to re-derive it from the membership list.
      categorySlug: primary,
      categories: p.categories || [],
      additional_categories: (p.taxonomy?.subgroupDesc || "").trim(),
      product: name,
      sku: p.sku,
      details: p.description || "",
      variants: detailBits.join(" · "),
      price: money(p.price),
      availability: p.availability === "InStock" ? "In stock" : p.availability || "",
      url: `https://www.uline.com/Product/Detail/${p.sku}`,
      source: "Uline product catalogue",
      image: hasLocalImage ? `/uline/${p.sku}.webp` : null,
      hasLocalImage,
      uline: {
        class: p.taxonomy?.classDesc || null,
        group: p.taxonomy?.groupDesc || null,
        subgroup: p.taxonomy?.subgroupDesc || null,
        // A "family" is Uline's own subgroup, which is what actually groups
        // variants of the same product. The browse page the SKU was found on is
        // kept separately, because that depends on crawl order.
        family: [p.taxonomy?.groupDesc, p.taxonomy?.subgroupDesc].filter(Boolean).join(" › ") || null,
        browseUrl: p.familyUrl || null,
        browseTitle: p.familyTitle || null,
        classNum: p.taxonomy?.classNum || null,
        groupNum: p.taxonomy?.groupNum || null,
        subgroupNum: p.taxonomy?.subgroupNum || null,
        size: p.size || null,
        dimensions: dims,
        width: p.width ?? null,
        height: p.height ?? null,
        color: p.color || null,
        unitPrice: p.price ?? null,
        bundlePrice: p.bundlePrice ?? null,
        bundleQty: p.bundleQty ?? null,
        priceValidUntil: p.priceValidUntil || null,
        condition: p.condition || null,
        currency: p.currency || "USD",
        canonicalUrl: p.url || null,
        imageUrl: p.image || null,
        extraction: p.extraction || "json-ld",
        partial: Boolean(p.partial),
      },
    };
  })
  .sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.categories[0] ?? "");
    const cb = CATEGORY_ORDER.indexOf(b.categories[0] ?? "");
    if (ca !== cb) return ca - cb;
    return a.product.localeCompare(b.product) || a.sku.localeCompare(b.sku);
  });

/* ---------------------------------------------------------------- report */

const perCategory = CATEGORY_ORDER.map((slug) => {
  const list = records.filter((r) => r.categories.includes(slug));
  return { slug, label: labelOf(slug), count: list.length };
});

const noCategory = records.filter((r) => !r.categories.length);
const noPrice = records.filter((r) => r.uline.unitPrice == null);
const noDims = records.filter((r) => !r.uline.dimensions);
const noImage = records.filter((r) => !r.uline.imageUrl);
const noLocalImage = records.filter((r) => !r.hasLocalImage);
const partial = records.filter((r) => r.uline.partial);

const families = new Map();
for (const r of records) {
  const key = r.uline.family || `sku:${r.sku}`;
  if (!families.has(key)) families.set(key, []);
  families.get(key).push(r.sku);
}
const familySizes = [...families.values()].map((v) => v.length).sort((a, b) => b - a);

console.log("shards:");
for (const s of shardStats) console.log(`  ${s.file.padEnd(26)} parsed ${String(s.parsed).padStart(4)} new ${String(s.new).padStart(4)} failed ${s.failed}`);
console.log("");
console.log(`products (unique SKUs) : ${records.length}`);
console.log(`families               : ${families.size}`);
console.log(`with a price           : ${records.length - noPrice.length}`);
console.log(`with dimensions        : ${records.length - noDims.length}`);
console.log(`with an image url      : ${records.length - noImage.length}`);
console.log(`with a local image     : ${records.length - noLocalImage.length}${noLocalImage.length ? ` (${noLocalImage.length} use the placeholder)` : ""}`);
console.log(`with no category       : ${noCategory.length}`);
console.log(`partial (no price)     : ${partial.length}${partial.length ? " -> " + [...new Set(partial.map((r) => r.uline.subgroup || r.category))].join(", ") : ""}`);
console.log(`unrecovered failures   : ${failures.length}`);
console.log("");
console.log(`largest families: ${familySizes.slice(0, 5).join(", ")}`);
console.log("");
console.log("per category:");
for (const c of perCategory) console.log(`  ${String(c.count).padStart(4)}  ${c.label}`);

const report = {
  generatedAt: new Date().toISOString(),
  counts: {
    products: records.length,
    families: families.size,
    withPrice: records.length - noPrice.length,
    withDimensions: records.length - noDims.length,
    withImage: records.length - noImage.length,
    withLocalImage: records.length - noLocalImage.length,
    noCategory: noCategory.length,
    failures: failures.length,
  },
  perCategory,
  failures,
  records,
};

fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + "\n");

if (dryRun) {
  console.log("");
  console.log("dry run — catalogue not written");
  process.exit(0);
}

if (fs.existsSync(CATALOG) && !fs.existsSync(BACKUP)) {
  fs.copyFileSync(CATALOG, BACKUP);
  console.log("");
  console.log(`backed up previous catalogue -> ${path.relative(ROOT, BACKUP)}`);
}

fs.writeFileSync(CATALOG, JSON.stringify({ uline: records }, null, 2) + "\n");
console.log("");
console.log(`wrote ${path.relative(ROOT, CATALOG)} (${records.length} products)`);

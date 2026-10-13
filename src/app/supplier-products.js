import supplierCatalog from "./supplier-catalog.json";

const placeholderImage = "/images/box-1.png";

/**
 * The catalogue is now Uline's, so every product is a Uline SKU. Each record
 * carries their class / group / subgroup taxonomy and a size triple; this file
 * maps that back onto the vocabulary the storefront already uses.
 *
 * The category list is duplicated from catalog.js rather than imported, because
 * catalog.js imports this module and a cycle would break the build.
 */
const CATEGORY = {
  "moving-boxes": { label: "Moving Boxes", type: "standard" },
  "moving-kits": { label: "Moving Kits", type: "moving-kits" },
  "packing-supplies": { label: "Packing Supplies", supply: "packing-materials" },
  "artwork-mirror": { label: "Artwork/Mirror", type: "mirror" },
  golf: { label: "Golf", type: "golf" },
  wardrobe: { label: "Wardrobe", type: "wardrobe" },
  lamp: { label: "Lamp", type: "lamp" },
  "moving-blankets": { label: "Moving Blankets, Pads and Supplies", supply: "furniture-protection" },
  "tv-boxes": { label: "TV Boxes", type: "electronics" },
  "dish-and-glass": { label: "Dish and Glass", type: "dish" },
  "storage-file": { label: "Storage/File", type: "storage" },
  bike: { label: "Bike", type: "bike" },
  mattress: { label: "Mattress", type: "mattress" },
  "bulk-cargo-containers": { label: "Bulk Cargo Containers", type: "bulk-cargo" },
  "round-trip-totes": { label: "Round Trip Totes", type: "round-trip-totes" },
};

// Sections the /boxes page adds on top of the store's own box types.
export const supplierBoxCategories = [
  { id: "mattress", title: "Mattress Cartons", blurb: "Cartons built to move mattresses and bedding." },
  { id: "moving-kits", title: "Moving Kits & Bundles", blurb: "Prepacked carton sets and bundles." },
  { id: "golf", title: "Golf Boxes", blurb: "Tall cartons for golf bags and clubs." },
  { id: "bike", title: "Bike Boxes", blurb: "Side-loading cartons for bicycles and frames." },
  { id: "lamp", title: "Lamp Boxes", blurb: "Tall cartons for lamp bases and shades." },
  { id: "bulk-cargo", title: "Bulk Cargo Containers", blurb: "Large-volume containers for bulky loads." },
  { id: "round-trip-totes", title: "Round Trip Totes", blurb: "Reusable totes that survive the return trip." },
];

export const supplierSupplyCategories = [
  { id: "packing-materials", label: "Packing materials" },
  { id: "furniture-protection", label: "Furniture & floor protection" },
  { id: "moving-equipment", label: "Moving equipment" },
  { id: "cargo-control", label: "Cargo control" },
  { id: "reusable-storage", label: "Reusable storage & crates" },
  { id: "safety-security", label: "Safety & security" },
  { id: "other-moving-supplies", label: "Other moving supplies" },
];

// Note: a default parameter only fires for `undefined`, and the catalogue uses
// null for a missing value — so this has to test for null explicitly, or
// `cleanText(null)` yields the string "null".
const cleanText = (value) => (value == null ? "" : String(value).replace(/\s+/g, " ").trim());
const slug = (value = "") => cleanText(value).toLowerCase().normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";

/** Uline's own copy, or the size triple, as a short purpose line. */
function purposeFor(record, categoryLabel) {
  const subgroup = cleanText(record.uline?.subgroup);
  if (subgroup && subgroup.toLowerCase() !== cleanText(record.product).toLowerCase()) return subgroup;
  return categoryLabel;
}

/**
 * Split a moving-blankets / packing-supplies record into the supply sections
 * the /extras page filters by. Uline's subgroup is the most reliable signal;
 * the product name is the fallback.
 */
function supplyCategoryFor(record, fallback) {
  const text = `${record.uline?.subgroup || ""} ${record.uline?.group || ""} ${record.product} ${record.details}`.toLowerCase();
  if (/dolly|dollies|hand truck|pallet|cart|ramp|walkboard|ladder|furniture skate|turn plate/.test(text)) return "moving-equipment";
  if (/strap|tie.down|winch|sling|\bnet\b|shoring|load bar|logistic track|rope|ratchet/.test(text)) return "cargo-control";
  if (/\bcrate\b|\bvault\b|\btote\b|\bbin\b|container/.test(text)) return "reusable-storage";
  if (/safety|glove|\block\b|security|\bppe\b/.test(text)) return "safety-security";
  if (/blanket|pad|cover|floor|carpet|scuff|shield|runner|door|banister/.test(text)) return "furniture-protection";
  if (/tape|bubble|stretch|newsprint|paper|wadding|cushion|foam|peanut|label|seal|corner|dispenser|knife|wrap/.test(text)) return "packing-materials";
  return fallback;
}

function roomsFor(type, categoryId) {
  if (type === "wardrobe" || type === "mattress") return ["bedroom"];
  if (type === "electronics") return ["living-room", "home-office"];
  if (type === "dish") return ["kitchen"];
  if (type === "mirror") return ["bedroom", "living-room"];
  if (type === "storage" || type === "round-trip-totes" || type === "bulk-cargo") return ["home-office", "garage"];
  if (type === "moving-kits") return ["whole-home"];
  if (type === "golf" || type === "bike") return ["garage"];
  if (type === "lamp") return ["living-room"];
  if (categoryId === "packing-materials") return ["whole-home"];
  if (categoryId === "furniture-protection") return ["bedroom", "living-room", "whole-home"];
  return ["whole-home", "garage"];
}

function excerpt(text, maxLength = 150) {
  const value = cleanText(text);
  if (value.length <= maxLength) return value;
  const boundary = value.lastIndexOf(" ", maxLength - 1);
  return `${value.slice(0, boundary > 80 ? boundary : maxLength).trim()}…`;
}

/** Uline's `size` string is a 2- or 3-part dimension list, e.g. `5x3` or `4x4x8`. */
function parseSize(value) {
  const parts = String(value || "").trim().split(/\s*x\s*/i);
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;
  return parts.map(Number);
}

/** `4x4x8` -> `4 × 4 × 8 in`; a label `5x3` -> `5 × 3 in`. */
function formatSize(dimensions, fallback) {
  if (dimensions) {
    const { length, width, height } = dimensions;
    return [length, width, height].filter((value) => value != null).join(" × ") + " in";
  }
  const parsed = parseSize(fallback);
  return parsed ? `${parsed.join(" × ")} in` : cleanText(fallback);
}

/** One Uline SKU -> one storefront product. */
function makeProduct(record, index) {
  const slugs = Array.isArray(record.categories) ? record.categories : [];
  // The catalogue build already picked the primary category; fall back to the
  // declared category order so the choice is stable either way.
  const primary = (record.categorySlug && CATEGORY[record.categorySlug])
    ? record.categorySlug
    : [...slugs].filter((s) => CATEGORY[s]).sort(
        (a, b) => Object.keys(CATEGORY).indexOf(a) - Object.keys(CATEGORY).indexOf(b),
      )[0] || null;
  const meta = primary ? CATEGORY[primary] : null;
  const categoryLabel = meta?.label || record.category || "Moving Supplies";
  const isBox = Boolean(meta?.type);
  const type = isBox ? meta.type : "supply";
  const categoryId = isBox ? undefined : supplyCategoryFor(record, meta?.supply || "other-moving-supplies");

  const uline = record.uline || {};
  const dims = uline.dimensions;
  const sizeText = dims || uline.size ? formatSize(dims, uline.size) : "";

  // Prefer the per-unit price; fall back to the bundle price so a product is
  // never silently unpriced.
  const unitPrice = uline.unitPrice ?? (uline.bundlePrice != null && uline.bundleQty ? uline.bundlePrice / uline.bundleQty : null);

  const detailParts = [];
  if (sizeText) detailParts.push(sizeText);
  if (uline.color) detailParts.push(uline.color);
  if (uline.bundleQty > 1) detailParts.push(`${uline.bundleQty} per bundle`);
  const snippet = excerpt(record.details);
  if (snippet) detailParts.push(snippet);

  const purpose = purposeFor(record, categoryLabel);
  const vendorCategories = [...new Set([categoryLabel, uline.group, uline.subgroup].map(cleanText).filter(Boolean))];
  const name = cleanText(record.product);

  return {
    id: `ul-${slug(record.sku)}-${index + 1}`,
    name,
    image: cleanText(record.image) || placeholderImage,
    price: unitPrice == null ? null : Number(unitPrice.toFixed(2)),
    currency: uline.currency || "USD",
    type,
    purpose,
    detail: detailParts.join(" · "),
    description: cleanText(record.details),
    supplier: cleanText(record.company) || "Uline",
    sku: cleanText(record.sku),
    // URL segment for this product's own page. SKUs are unique, so this is too.
    slug: slug(record.sku),
    vendorCategory: categoryLabel,
    vendorCategories,
    availability: cleanText(record.availability),
    sourceUrl: cleanText(record.url),
    sourceName: cleanText(record.source),
    categoryId,
    sourceCategory: cleanText(record.category),
    isSupplierCatalog: true,
    estimatedPrice: false,
    // Uline-specific extras, kept so product pages can show the real figures.
    ulineCategorySlug: primary,
    ulineTaxonomy: { class: uline.class, group: uline.group, subgroup: uline.subgroup },
    size: sizeText || null,
    color: cleanText(uline.color) || null,
    // Uline writes the condition as a schema.org enum; the page wants prose.
    condition: cleanText(uline.condition) === "NewCondition" ? "New" : cleanText(uline.condition) || null,
    priceValidUntil: cleanText(uline.priceValidUntil) || null,
    // Uline's own one-line description of this variant, e.g.
    // `15 × 12 × 10" · White · 25 per bundle`.
    variantLabel: cleanText(record.variants) || null,
    partial: Boolean(uline.partial),
    bundlePrice: uline.bundlePrice ?? null,
    bundleQty: uline.bundleQty ?? null,
    rooms: roomsFor(type, categoryId),
    searchText: [
      name, purpose, categoryLabel, vendorCategories.join(" "), record.details,
      record.sku, "uline", sizeText, uline.class, uline.group, uline.subgroup,
    ].filter(Boolean).join(" ").toLowerCase(),
  };
}

const ulineProducts = (supplierCatalog.uline || []).map(makeProduct);

export const supplierBoxProducts = ulineProducts.filter((product) => product.type !== "supply");
export const supplierSupplyProducts = ulineProducts.filter((product) => product.type === "supply");

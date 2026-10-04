import supplierCatalog from "./supplier-catalog.json";

const placeholderImage = "/images/box-1.png";

export const supplierBoxCategories = [
  { id: "mattress", title: "Mattress Cartons", blurb: "Cartons made for moving mattresses and bedding." },
  { id: "moving-kits", title: "Moving Kits & Bundles", blurb: "Prepacked moving carton sets and bundles." },
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

const supplierBoxTypeLabels = {
  standard: "Standard moving boxes",
  wardrobe: "Wardrobe & clothing boxes",
  electronics: "TV & electronics boxes",
  dish: "Dish & glass boxes",
  mirror: "Mirror & picture boxes",
  specialty: "Specialty moving boxes",
  storage: "Storage cartons & crates",
  mattress: "Mattress cartons",
  "moving-kits": "Moving kits & bundles",
};

const cleanText = (value = "") => String(value).replace(/\s+/g, " ").trim();
const slug = (value = "") => cleanText(value).toLowerCase().normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";

function parsePrice(text = "") {
  const match = String(text).match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function splitSupplierCategories(record) {
  const related = (record.additional_categories || "").split(";").map(cleanText).filter(Boolean)
    .filter((category) => !/^(EA|oversized)$/i.test(category) && !/^[A-Z]{2,}\d+$/i.test(category));
  return [...new Set([record.category, ...related].map(cleanText).filter(Boolean))];
}

function isBoxRecord(record) {
  const primary = cleanText(record.category).toLowerCase();
  const text = `${primary} ${record.product}`.toLowerCase();
  return primary.startsWith("boxes >") || /\b(carton|cartons|box|boxes|wardrobe carton|mirror carton|mattress carton|pak.n.move kit)\b/.test(text);
}

function boxTypeFor(record) {
  const text = `${record.category} ${record.additional_categories} ${record.product} ${record.details}`.toLowerCase();
  if (/mattress carton/.test(text)) return "mattress";
  if (/pak.n.move|moving kit/.test(text)) return "moving-kits";
  if (/wardrobe/.test(text)) return "wardrobe";
  if (/flat screen|\btv\b|television|monitor carton/.test(text)) return "electronics";
  if (/dish|glassware|glass pack/.test(text)) return "dish";
  if (/mirror|picture carton/.test(text)) return "mirror";
  if (/crate|vault|file carton|storage/.test(text)) return "storage";
  if (/specialty carton|specialty box/.test(text)) return "specialty";
  return "standard";
}

function supplyCategoryFor(record) {
  const text = `${record.category} ${record.additional_categories} ${record.product} ${record.details}`.toLowerCase();
  if (/cargo|tie.down|strap|winch|separator net|\bnet\b|sling|shoring|load bar|logistic track|\brope\b|fastener/.test(text)) return "cargo-control";
  if (/hand truck|dolly|dollies|pallet jack|pallet truck|\bcart\b|\bcarts\b|ramp|walkboard|piano moving|furniture skate|turn plate|ladder|machine moving/.test(text)) return "moving-equipment";
  if (/crate|vault|\btote\b|\bbins?\b|e-crate|moving container/.test(text)) return "reusable-storage";
  if (/safety|\bppe\b|glove|gloves|\block\b|locks|security/.test(text)) return "safety-security";
  if (/furniture|mattress|sofa|cover|pad|blanket|floor|carpet|scuff|shield|runner|door protector|banister/.test(text)) return "furniture-protection";
  if (/tape|bubble|stretch wrap|newsprint|paper|wadding|cushion|microfoam|peanuts|rubber band|label|seal|packaging/.test(text)) return "packing-materials";
  return "other-moving-supplies";
}

function supplierRooms(type) {
  if (type === "wardrobe" || type === "mattress") return ["bedroom"];
  if (type === "electronics") return ["living-room", "home-office"];
  if (type === "dish") return ["kitchen"];
  if (type === "mirror") return ["bedroom", "living-room"];
  if (type === "storage") return ["home-office", "garage"];
  if (type === "moving-kits") return ["whole-home"];
  return ["whole-home", "garage"];
}

function visibleCategory(record, box, type, categoryId) {
  const primary = cleanText(record.category);
  if (!/^(uncategorized|overstock)$/i.test(primary) && !/informational text blocks/i.test(primary)) return primary;
  const extras = (record.additional_categories || "").split(";").map(cleanText)
    .filter((category) => category && !/^(EA|oversized)$/i.test(category) && !/^[A-Z]{2,}\d+$/i.test(category));
  if (/informational text blocks/i.test(primary) && extras.length) return extras[0];
  return box ? supplierBoxTypeLabels[type] : supplierSupplyCategories.find((category) => category.id === categoryId)?.label || "Other moving supplies";
}

function excerpt(text, maxLength = 150) {
  const value = cleanText(text).replace(/^listing details:\s*/i, "");
  if (value.length <= maxLength) return value;
  const boundary = value.lastIndexOf(" ", maxLength - 1);
  return `${value.slice(0, boundary > 80 ? boundary : maxLength).trim()}…`;
}

function splitVariant(segment, record, index) {
  const price = parsePrice(segment);
  const priceAt = segment.indexOf("$");
  const beforePrice = cleanText(priceAt >= 0 ? segment.slice(0, priceAt) : segment)
    .replace(/\s+[—–-]\s*$/, "");
  const taggedSku = beforePrice.match(/\bSKU\s*:?[ \t]*(.+)$/i);
  let sku = "";
  let label = "";

  if (taggedSku) {
    sku = cleanText(taggedSku[1]).replace(/\s*[—–-]\s*$/, "");
    label = cleanText(beforePrice.slice(0, taggedSku.index)).replace(/\s+[—–-]\s*$/, "");
  } else {
    const divided = beforePrice.match(/^(.+?)\s+[—–]\s+(.+)$/);
    if (divided) {
      label = cleanText(divided[1]);
      sku = cleanText(divided[2]);
    } else if (/^[A-Z0-9][A-Z0-9./_-]{2,}$/i.test(beforePrice)) {
      sku = beforePrice;
    } else {
      label = beforePrice;
    }
  }

  if (!sku) {
    const parentSkus = cleanText(record.sku).split(/[;,]/).map(cleanText).filter(Boolean);
    sku = parentSkus[index] || parentSkus[0] || "";
  }
  return { label, sku, price };
}

function newHavenVariants(record) {
  const raw = cleanText(record.variants);
  const segments = raw.split(/\s*\|\s*/).filter(Boolean);
  return segments.map((segment, index) => splitVariant(segment, record, index))
    .filter((variant) => variant.price != null);
}

function estimateCdsPrice(record) {
  const text = `${record.category} ${record.product} ${record.details}`.toLowerCase();
  if (/electric pallet jack|electric pallet truck/.test(text)) return 1499;
  if (/pallet jack|pallet truck/.test(text)) return 399;
  if (/ramp|walkboard|loading board/.test(text)) return 189;
  if (/hand truck|appliance dolly|dolly|dollies|furniture skate/.test(text)) return 129;
  if (/cart|platform truck/.test(text)) return 149;
  if (/crate|vault|e-crate|moving container/.test(text)) return 39.99;
  if (/mattress carton/.test(text)) return 19.99;
  if (/wardrobe/.test(text)) return 14.99;
  if (/dishpack|dish pack/.test(text)) return 11.99;
  if (/carton|\bbox\b/.test(text)) return /\b(xl|x-large|extra large|6\.?0 cu|6 cu)\b/.test(text) ? 11.99 : 7.99;
  if (/strap|tie.down|cargo|winch|sling|net|shoring|load bar|track/.test(text)) return 24.99;
  if (/tape|velcro/.test(text)) return 6.99;
  if (/bubble wrap|stretch wrap/.test(text)) return 19.99;
  if (/newsprint|paper|cushion|foam|peanut|rubber band/.test(text)) return 16.99;
  if (/pad|blanket|furniture protector/.test(text)) return 24.99;
  if (/bag|cover/.test(text)) return 12.99;
  if (/label|seal/.test(text)) return 5.99;
  if (/lock|security|safety|glove/.test(text)) return 14.99;
  return 19.99;
}

function makeProduct(record, supplierIndex, variant, variantIndex, supplier) {
  const box = isBoxRecord(record);
  const type = box ? boxTypeFor(record) : "supply";
  const categoryId = box ? undefined : supplyCategoryFor(record);
  const primaryCategory = visibleCategory(record, box, type, categoryId);
  const vendorCategories = [primaryCategory, ...splitSupplierCategories(record).slice(1)];
  const sku = cleanText(variant.sku || record.sku);
  const variantLabel = cleanText(variant.label);
  const hasMultipleVariants = supplier === "New Haven" && cleanText(record.variants).includes("|");
  const displayVariant = variantLabel || (hasMultipleVariants ? sku : "");
  const name = displayVariant ? `${cleanText(record.product)} — ${displayVariant}` : cleanText(record.product);
  const estimated = supplier === "CDS";
  const detailParts = [];
  if (variantLabel) detailParts.push(variantLabel);
  if (sku) detailParts.push(`SKU ${sku}`);
  if (estimated) detailParts.push("Estimated USD price");
  const descriptionSnippet = excerpt(record.details);
  if (descriptionSnippet) detailParts.push(descriptionSnippet);
  const detail = detailParts.join(" · ");
  const id = `${supplier === "CDS" ? "cds" : "nh"}-${slug(record.product)}-${supplierIndex + 1}-${variantIndex + 1}`;

  return {
    id,
    name,
    image: cleanText(record.image) || placeholderImage,
    price: Number(variant.price.toFixed(2)),
    currency: "USD",
    type,
    purpose: primaryCategory,
    detail,
    description: cleanText(record.details).replace(/^listing details:\s*/i, ""),
    supplier,
    sku,
    vendorCategory: primaryCategory,
    vendorCategories,
    availability: cleanText(record.availability),
    sourceUrl: cleanText(record.url),
    sourceName: cleanText(record.source),
    categoryId,
    sourceCategory: cleanText(record.category),
    isSupplierCatalog: true,
    estimatedPrice: estimated,
    rooms: box ? supplierRooms(type) : undefined,
    searchText: `${name} ${primaryCategory} ${vendorCategories.join(" ")} ${descriptionSnippet} ${cleanText(record.details)} ${sku} ${supplier}`.toLowerCase(),
  };
}

const newHavenProducts = supplierCatalog.newhaven.flatMap((record, supplierIndex) => {
  const variants = newHavenVariants(record);
  return variants.map((variant, variantIndex) => makeProduct(record, supplierIndex, variant, variantIndex, "New Haven"));
});

const cdsProducts = supplierCatalog.cds.map((record, supplierIndex) => makeProduct(
  record,
  supplierIndex,
  { label: "", sku: record.sku, price: estimateCdsPrice(record) },
  0,
  "CDS",
));

export const supplierBoxProducts = [...newHavenProducts, ...cdsProducts].filter((product) => product.type !== "supply");
export const supplierSupplyProducts = [...newHavenProducts, ...cdsProducts].filter((product) => product.type === "supply");

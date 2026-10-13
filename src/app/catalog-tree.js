import { movingCategories } from "./catalog";
import { supplierBoxProducts, supplierSupplyProducts } from "./supplier-products";

/**
 * The 446 Uline products filed under the 15 categories on the homepage, split
 * into the subcategories Uline itself uses. Everything the category and product
 * pages render comes from here, so the two stay in step.
 */

/** Every product we stock, in one list. */
export const allProducts = [...supplierBoxProducts, ...supplierSupplyProducts];

/** Label to fall back on when a product carries no Uline taxonomy at all. */
const categoryLabel = Object.fromEntries(movingCategories.map((category) => [category.id, category.label]));

/** Uline ships trademark symbols inside their subgroup names. Drop them. */
const tidy = (value) => String(value ?? "").replace(/[®™©]/g, "").replace(/\s+/g, " ").trim();

export const slugify = (value) => tidy(value).toLowerCase().normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The Uline subgroup a product sits in — that is our subcategory. A dozen
 * products (the Round Trip Totes template, a Keepbox, a pallet marker) carry no
 * taxonomy at all, so for those we take the family name from the product name
 * itself, which Uline writes as `<family> - <variant>`.
 */
export function subcategoryName(product) {
  const taxonomy = product.ulineTaxonomy || {};
  const subgroup = tidy(taxonomy.subgroup) || tidy(taxonomy.group);
  if (subgroup) return subgroup;
  const family = tidy(product.name).split(" - ")[0];
  return family || tidy(categoryLabel[product.ulineCategorySlug]) || "Other";
}

function buildCategory(category) {
  const products = allProducts.filter((product) => product.ulineCategorySlug === category.id);
  const groups = new Map();
  for (const product of products) {
    const name = subcategoryName(product);
    const id = slugify(name) || "other";
    if (!groups.has(id)) groups.set(id, { id, name, products: [] });
    groups.get(id).products.push(product);
  }
  const subcategories = [...groups.values()]
    .sort((a, b) => b.products.length - a.products.length || a.name.localeCompare(b.name));
  return { ...category, count: products.length, subcategories, products };
}

export const categoryTree = movingCategories.map(buildCategory);

export const categoryTreeBySlug = Object.fromEntries(categoryTree.map((category) => [category.id, category]));

export function getCategoryTree(slug) {
  return categoryTreeBySlug[slug] || null;
}

export const productsBySlug = Object.fromEntries(allProducts.map((product) => [product.slug, product]));

export function getProductBySlug(slug) {
  return productsBySlug[slug] || null;
}

/** Which subcategory a product belongs to, as the category page groups it. */
export function subcategoryFor(product) {
  const category = categoryTreeBySlug[product.ulineCategorySlug];
  if (!category) return null;
  const id = slugify(subcategoryName(product));
  return category.subcategories.find((group) => group.id === id) || null;
}

/** Other products in the same subcategory first, then the rest of the category. */
export function relatedProducts(product, limit = 8) {
  const category = categoryTreeBySlug[product.ulineCategorySlug];
  if (!category) return [];
  const sibling = subcategoryFor(product);
  const pool = [...(sibling?.products || []), ...category.products];
  const seen = new Set([product.slug]);
  const result = [];
  for (const candidate of pool) {
    if (seen.has(candidate.slug)) continue;
    seen.add(candidate.slug);
    result.push(candidate);
    if (result.length === limit) break;
  }
  return result;
}

/** Product image, already a path from the catalogue; placeholder when Uline has none. */
export const imageFor = (product) => product.image || "/images/box-1.png";

/** Prices are USD from the catalogue. `null` means Uline publishes none. */
export const formatPrice = (value) => value == null ? null : `$${Number(value).toFixed(2)}`;

/**
 * The spec table on a product page, as label/value pairs. Only rows with real
 * data are returned — roughly a third of the catalogue has no dimensions, and
 * twelve products have no price at all.
 */
export function productSpecs(product) {
  const specs = [
    ["SKU", product.sku],
    ["Size", product.size],
    ["Colour", product.color],
    ["Bundle", product.bundleQty > 1
      ? `${product.bundleQty} per bundle${product.bundlePrice != null ? ` · ${formatPrice(product.bundlePrice)}` : ""}`
      : null],
    ["Category", categoryLabel[product.ulineCategorySlug] || product.vendorCategory],
    ["Subcategory", subcategoryName(product)],
    ["Availability", product.availability],
    ["Condition", product.condition],
    ["Price valid until", product.priceValidUntil],
    ["Supplier", product.supplier],
  ];
  return specs.filter(([, value]) => value != null && String(value).trim() !== "");
}

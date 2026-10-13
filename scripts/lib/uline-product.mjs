/**
 * Parse a Uline product detail page into one record.
 *
 * Two data islands carry everything we need, both rendered server-side:
 *
 *   1. schema.org JSON-LD (`application/ld+json`, with the "+" written as
 *      `&#x2B;`) — name, description, dimensions, colour, price, availability.
 *   2. a `dataLayer.push({ 'event': 'Product_Details', ... })` block — Uline's
 *      own class / group / subgroup taxonomy plus the item description.
 *
 * The JSON-LD is parsed *before* decoding HTML entities, because Uline escapes
 * embedded quotes as `&quot;` and that is what keeps the JSON valid.
 */

const ENTITIES = {
  amp: "&", quot: '"', apos: "'", nbsp: " ", gt: ">", lt: "<",
  reg: "®", trade: "™", copy: "©", deg: "°", ndash: "–", mdash: "—", hellip: "…",
};

/**
 * Decode HTML entities and drop inline markup.
 *
 * Both steps have to repeat, and in that order, on every pass. Uline escapes
 * markup as well as entities, so `Keepbox<sup>&trade;</sup>` actually arrives as
 * `Keepbox&lt;sup&gt;&amp;trade;&lt;/sup&gt;`: the tags only become visible after
 * the first decode, and the trademark only resolves on the second.
 */
export function decodeEntities(s = "") {
  let value = String(s);
  for (let pass = 0; pass < 4; pass += 1) {
    const before = value;
    value = value
      .replace(/<[^>]*>/g, "")
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole);
    if (value === before) break;
  }
  return value.replace(/\s+/g, " ").trim();
}

const num = (v) => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** Pull the `Product_Details` taxonomy island out of the page. */
function taxonomy(html) {
  const m = html.match(/dataLayer\.push\(\{\s*'event':\s*'Product_Details'[\s\S]*?\}\)/);
  if (!m) return null;
  const grab = (key) => {
    const r = m[0].match(new RegExp(`'${key}':\\s*'((?:[^'\\\\]|\\\\.)*)'`));
    return r ? decodeEntities(r[1]) : null;
  };
  return {
    classDesc: grab("productClassDesc"),
    groupDesc: grab("productGroupDesc"),
    subgroupDesc: grab("productSubgroupDesc"),
    itemDesc: grab("productItemDesc"),
    isChildRootItem: grab("productChildRootItem"),
    price: num(grab("productPrice")),
  };
}

/** Parse one product page. Returns null when the page has no product JSON-LD. */
export function parseProductPage(html, { sku: skuHint = null } = {}) {
  const m = html.match(/application\/ld(?:&#x2B;|\+);?json"?[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;

  let ld;
  try {
    ld = JSON.parse(m[1].trim());
  } catch {
    return null;
  }
  if (!ld || ld["@type"] !== "Product") return null;

  const offer = ld.offers || {};
  const unit = offer.priceSpecification || {};
  const bundleQty = num(unit.eligibleQuantity?.minValue) ?? 1;
  const unitPrice = num(unit.price);
  const bundlePrice = num(offer.price);
  const tax = taxonomy(html);

  const sizeRaw = ld.size?.value ?? null;
  const sizeParts = sizeRaw
    ? String(sizeRaw).split(/\s*[x×]\s*/).map(num).filter((n) => n != null)
    : [];

  return {
    sku: ld.sku || skuHint,
    name: decodeEntities(ld.name),
    description: decodeEntities(ld.description),
    url: ld.identifier || offer.url || null,
    image: ld.image || null,
    color: ld.color ? decodeEntities(ld.color) : null,
    // Uline's `size` is the full L x W x H triple; width/height are also given
    // separately but depth never is, so the triple is the reliable source.
    size: sizeRaw,
    dimensions: sizeParts.length >= 3
      ? { length: sizeParts[0], width: sizeParts[1], height: sizeParts[2] }
      : null,
    width: num(ld.width?.value),
    height: num(ld.height?.value),
    availability: (offer.availability || "").replace("https://schema.org/", "") || null,
    condition: (ld.itemCondition || "").replace("https://schema.org/", "") || null,
    currency: offer.priceCurrency || "USD",
    price: unitPrice,                    // per-unit price, the one customers compare
    bundlePrice,                         // what a bundle of `bundleQty` costs
    bundleQty,
    priceValidUntil: offer.priceValidUntil || null,
    seller: offer.seller?.name || null,
    taxonomy: tax,
    // Uline's own product name is cleaner than the JSON-LD one for display.
    itemDescription: tax?.itemDesc || null,
    extraction: "json-ld",
    partial: false,
  };
}

/** Group SKUs into families using the family page each was found on. */
export function groupIntoFamilies(skuEntries) {
  const byFamily = new Map();
  for (const entry of skuEntries) {
    const key = entry.familyUrl || `sku:${entry.sku}`;
    if (!byFamily.has(key)) byFamily.set(key, { url: key, title: entry.familyTitle || null, skus: [] });
    byFamily.get(key).skus.push(entry);
  }
  return [...byFamily.values()];
}

/**
 * Fallback for the handful of product pages that ship no JSON-LD at all.
 *
 * Uline's Round Trip Totes template is the notable one: it has no schema.org
 * block and no `Product_Details` island, and the price is never rendered into
 * the DOM — even after the page's own JavaScript runs. What it does expose is
 * the item description and its internal hierarchy ids, so those are what we
 * take. `price` comes back null and the record is marked `partial`.
 */
export function parseProductPageFallback(html, { sku } = {}) {
  const desc = html.match(/id="hdnItemDescription"[^>]*value="([^"]*)"/);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const titleTag = html.match(/<title>([^<]*)/);

  let name = decodeEntities(desc?.[1] || h1?.[1] || titleTag?.[1] || sku)
    .replace(/\s*[-|]\s*ULINE\s*$/i, "")
    .trim();
  if (sku) name = name.replace(new RegExp(`\\s*-\\s*${sku}\\s*$`, "i"), "").trim();
  if (!name) return null;

  const dims = name.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
  const hierarchy = html.match(
    /id="ProductDetailHierarchyData"[^>]*data-class="(\d+)"[^>]*data-group="(\d+)"[^>]*data-subgroup="(\d+)"/,
  );

  return {
    sku,
    name,
    description: "",
    url: `https://www.uline.com/Product/Detail/${sku}`,
    image: `https://img.uline.com/is/image/uline/${sku}`,
    color: null,
    size: dims ? `${dims[1]}x${dims[2]}x${dims[3]}` : null,
    dimensions: dims
      ? { length: Number(dims[1]), width: Number(dims[2]), height: Number(dims[3]) }
      : null,
    width: dims ? Number(dims[2]) : null,
    height: dims ? Number(dims[3]) : null,
    availability: null,
    condition: null,
    currency: "USD",
    price: null,
    bundlePrice: null,
    bundleQty: null,
    priceValidUntil: null,
    seller: "Uline",
    taxonomy: {
      classDesc: null,
      groupDesc: null,
      subgroupDesc: null,
      classNum: hierarchy?.[1] || null,
      groupNum: hierarchy?.[2] || null,
      subgroupNum: hierarchy?.[3] || null,
      itemDesc: name,
      isChildRootItem: null,
      price: null,
    },
    itemDescription: name,
    extraction: "fallback",
    partial: true,
  };
}

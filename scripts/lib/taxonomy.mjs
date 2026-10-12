/**
 * Shared product taxonomy + dimension parsing.
 *
 * Used by scripts/cross-reference.mjs and scripts/category-coverage.mjs so both
 * classify products identically.
 */

/* ------------------------------------------------------------------ *
 * Dimensions
 * ------------------------------------------------------------------ */

const NUM = String.raw`\d+(?:\s+\d+\/\d+|[.\-/]\d+)?`;
const DIM_RE = new RegExp(
  `(${NUM})\\s*(?:"|\u201d|in\\b|inch)?\\s*[x\u00d7]\\s*(${NUM})\\s*(?:"|\u201d|in\\b|inch)?\\s*[x\u00d7]\\s*(${NUM})`,
  "i",
);

function toNumber(token) {
  const t = String(token).trim();
  let m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** First W x D x H triple in a blob of text, or null. */
export function dimsOf(text) {
  const m = String(text || "").match(DIM_RE);
  if (!m) return null;
  const v = [toNumber(m[1]), toNumber(m[2]), toNumber(m[3])];
  if (v.some((n) => n === null)) return null;
  return v;
}

const round = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
export const dimLabel = (d) => (d ? `${d.map(round).join(" x ")}"` : "");
const dimSorted = (d) => (d ? [...d].sort((a, b) => a - b) : null);

export const sameSize = (a, b) => {
  const A = dimSorted(a), B = dimSorted(b);
  if (!A || !B) return false;
  return A.every((n, i) => Math.abs(n - B[i]) < 0.05);
};

/** Rough "how different are these two boxes" number, for nearest-first display. */
export function sizeDistance(a, b) {
  const A = dimSorted(a), B = dimSorted(b);
  if (!A || !B) return Infinity;
  return A.reduce((sum, n, i) => sum + Math.abs(n - B[i]), 0);
}

/* ------------------------------------------------------------------ *
 * Canonical product types
 * ------------------------------------------------------------------ *
 * Order matters — first pattern wins. Each rule is anchored on words that only
 * appear on that kind of product, so a "Hand Truck Cover" never lands in the
 * blanket bucket and a "Bubble Corner Guard" is a corner guard, not a bubble.
 */
export const TYPES = [
  // --- boxes / cartons ------------------------------------------------
  ["dishpack",            /\b(dish\s*-?\s*pack|dishpack|dish\b|glass\s*(pack|saver)|partition\s+set|cell\s+kit)/i],
  ["wardrobe-box",        /\b(wardrobe|hanger\s+bar|garment\s+(box|carton))/i],
  ["mirror-box",          /\b(mirror|artwork)\s*(box|carton|corrugated|shipper|pack)?\b/i],
  ["mattress-bag",        /\b(mattress|bedding)\s*(bag|cover)/i],
  ["mattress-box",        /\b(mattress|bedding)\s*(box|carton|ctn)?\b/i],
  ["tv-box",              /\b(flat\s*-?\s*(panel|screen)|plasma|tv\s*-?\s*(box|ctn|carton)|television\s+(box|carton)|tv\s+or\s+picture)/i],
  ["lamp-box",            /\blamp\s*(base\s*)?(cartons?|boxes?|box|carton)\b/i],
  ["guitar-box",          /\bguitar\s*(box|carton)?\b/i],
  ["golf-box",            /\bgolf\b/i],
  ["long-gun-box",        /\b(rifle|firearm|shotgun)/i],
  ["board-box",           /\b(ski|snowboard|snow\s+board|surfboard|surf\s+board)\b/i],
  ["skateboard-box",      /\bskateboard\b/i],
  ["keyboard-box",        /\bkeyboard\s+box/i],
  ["electronics-box",     /\belectronics?\s+box/i],
  ["racquet-box",         /\b(tennis\s+racquet|racquet)s?\b/i],
  ["side-loader-box",     /\bside\s*-?\s*load(ing)?\b/i],
  ["tall-box",            /\btall\s+(corrugated\s+)?box/i],
  ["telescopic-box",      /\btelescop/i],
  ["suitcase-box",        /\b(suitcase|suit\s+shipper)/i],
  ["gondola-box",         /\bgondola\b/i],
  ["handhole-box",        /\bhand\s+holes?\b/i],
  ["corrugated-tote",     /\bcorrugated\s+totes?\b/i],
  ["round-trip-tote",     /\b(round\s+trip\s+tote|keepbox|keep\s+box|flip-?top|hang.?n.?stor|e-?crate|polypropylene)/i],
  ["storage-drawer",      /\bstorage\s+drawers?\b/i],
  ["file-folder",         /\bfile\s+folders?\b/i],
  ["file-box",            /\b(file\s+(carton|box|storage)|storage\s+file|record\s+storage|bankers\s*box|r-?kive|document\s+case|quick\s+file|lateral\s+file|magazine\s+storage|roll\s+storage)/i],
  ["moving-kit",          /\b(moving\s+kit|pak.?n.?move\s+kit|moving\s+bundle|kit\s*-\s*\d+\s*to\s*\d+\s*bedroom)/i],
  ["speed-pack",          /\bspeed\s*pack/i],
  ["bulk-container",      /\b(bulk\s+(container|cargo|bin)|cargo\s+container|gaylord|octagon\s+bulk|easy\s+loader|pallet\s+(box|tray)|triple\s+wall|double\s+wall\s+box)/i],
  ["milk-crate",          /\bmilk\s+crate/i],
  ["plastic-storage-box", /\bplastic\s+storage\s+box/i],
  ["crate",               /\bcrate\b/i],
  ["bin",                 /\bbin\b/i],

  // --- packing supplies -----------------------------------------------
  ["moving-blanket",      /\bmoving\s+blanket/i],
  ["paper-pad",           /\b(paper\s+(moving\s+)?pad|moving\s+pad)/i],
  ["corner-protector",    /\b(corner\s+(protector|guard)|edge\s+protector|u-?channel)/i],
  ["bubble-wrap",         /\bbubble\b/i],
  ["stretch-wrap",        /\b(stretch\s+wrap|cast\s+wrap|goodwrapper|econo.?wrapper|shrink\s+wrap)/i],
  ["newsprint",           /\bnewsprint/i],
  ["kraft-paper",         /\b(kraft\s+paper|wadding)/i],
  ["foam",                /\b(microfoam|peanuts?|styrofoam|cushion\s+foam|foam\s+(sheet|sheets|edge|dispenser|wrap|packing|roll|rolls|pad|pads|block|blocks|cushion|insert)|packing\s+foam)/i],
  ["corrugated-sheet",    /\bcorrugated\s+(sheets?|paper)/i],
  ["tape",                /\b(carton\s+sealing\s+tape|packing\s+tape|tape\b)/i],
  ["label",               /\b(labels?|pallet\s+markers?|markers?|fragile)/i],
  ["dispenser",           /\bdispenser/i],
  ["knife",               /\b(knife|knives)/i],
  ["door-jamb",           /\bdoor\s+jamb/i],
  ["furniture-slide",     /\b(furniture\s+slide|furniture\s+skate|turn\s+plate)/i],
  ["ram-board",           /\bram\s+board/i],
  ["carpet-protection",   /\b(carpet\s+(protect|shield)|scuff\s+shield)/i],
  ["floor-protection",    /\b(neoprene|floor\s+runner|floor\s+protection|poly\s+sheet)/i],

  // --- equipment ------------------------------------------------------
  // Checked before the loose supply words below, so "dolly with foam wheels"
  // is a dolly and not a packing foam.
  ["shoulder-dolly",      /\bshoulder\s+dolly/i],
  ["hand-truck-cover",    /\bhand\s+truck\s+cover/i],
  ["hand-truck",          /\bhand\s+truck/i],
  ["dolly",               /\b(dolly|dollies)/i],
  ["material-handling",   /\b(pallet\s+(jack|truck|puller|vault|pallet)|lift\s+truck|stacker|ladders?|file\s+truck)/i],
  ["panel-cart",          /\b(panel\s+cart|library\s+cart|machine\s+cart|office\s+cart|platform\s+truck|\bcarts?\b)/i],
  ["piano-equipment",     /\bpiano/i],
  ["machine-moving",      /\bmachine\s+moving/i],
  ["ramp",                /\b(ramp|walkboard)/i],
  ["winch",               /\bwinch/i],
  ["load-bar",            /\b(load\s+bar|shoring)/i],
  ["lifting-strap",       /\b(lifting\s+strap|carry\s+and\s+lift|carrying\s+strap)/i],

  // --- loose buckets, keep near the end --------------------------------
  ["cargo-hardware",      /\b(logistic\s+(track|sleeve)|jack\s+bar|e\s+fitting|cluster\s+hook|tension\s+tie|tarp\s+(tie|fastener)|utility\s+cord|rubber\s+band)/i],
  ["cargo-net",           /\b(net|separator|slings?)/i],
  ["strap",               /\b(strap|tie\s*down|webbing|rope|twine)/i],
  ["safety",              /\b(safety|ppe|gloves?|locks?|security)/i],
  ["cover",               /\bcover/i],
  ["bag",                 /\bbags?\b/i],
  ["pad",                 /\bpads?\b/i],

  // --- catch-all, must stay last ---------------------------------------
  ["wine-box",            /\bwine\b/i],
  ["sofa-box",            /\b(sofa|couch)\b/i],
  ["clock-box",           /\bclock\b/i],
  ["generic-box",         /\b(corrugated\s+box(es)?|cartons?|boxes|box)\b/i],
];

export function typeOf(text) {
  const t = String(text || "");
  for (const [name, re] of TYPES) if (re.test(t)) return name;
  return "unclassified";
}

/**
 * Classify one of our supplier records. The product name wins; category labels
 * are noisy ("Speed pack/commercial bins" would otherwise turn a Gaylord box
 * into a speed pack).
 */
export function typeOfRecord(record) {
  const byName = typeOf(record.product);
  return byName !== "unclassified" ? byName : typeOf(record.category);
}

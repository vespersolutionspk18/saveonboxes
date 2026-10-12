/**
 * The 15 Uline-derived categories, and which product type belongs in each.
 *
 * Shared by scripts/category-coverage.mjs (reporting) and
 * scripts/prune-catalog.mjs (removing products that fit nowhere), so the two
 * can never disagree about what "fits" means.
 */

export const CATEGORIES = {
  "moving-boxes": "Moving Boxes",
  "moving-kits": "Moving Kits",
  "packing-supplies": "Packing Supplies",
  "artwork-mirror": "Artwork/Mirror",
  golf: "Golf",
  wardrobe: "Wardrobe",
  lamp: "Lamp",
  "moving-blankets": "Moving Blankets, Pads and Supplies",
  "tv-boxes": "TV Boxes",
  "dish-and-glass": "Dish and Glass",
  "storage-file": "Storage/File",
  bike: "Bike",
  mattress: "Mattress",
  "bulk-cargo-containers": "Bulk Cargo Containers",
  "round-trip-totes": "Round Trip Totes",
};

/**
 * Product type -> [category slug, fit]
 *
 * "fits"  — clearly belongs in that category
 * "loose" — we could file it there, but it's a stretch
 *
 * A type absent from this map has no home in any of the 15.
 */
export const MAP = {
  // clean fits
  dishpack: ["dish-and-glass", "fits"],
  "wardrobe-box": ["wardrobe", "fits"],
  "mirror-box": ["artwork-mirror", "fits"],
  "mattress-box": ["mattress", "fits"],
  "tv-box": ["tv-boxes", "fits"],
  "lamp-box": ["lamp", "fits"],
  "golf-box": ["golf", "fits"],
  "tall-box": ["golf", "fits"],
  "round-trip-tote": ["round-trip-totes", "fits"],
  "storage-drawer": ["storage-file", "fits"],
  "file-folder": ["storage-file", "fits"],
  "file-box": ["storage-file", "fits"],
  "milk-crate": ["storage-file", "fits"],
  "plastic-storage-box": ["storage-file", "fits"],
  "moving-kit": ["moving-kits", "fits"],
  "bulk-container": ["bulk-cargo-containers", "fits"],
  "generic-box": ["moving-boxes", "fits"],
  "handhole-box": ["moving-boxes", "fits"],
  "moving-blanket": ["moving-blankets", "fits"],
  "paper-pad": ["moving-blankets", "fits"],
  "door-jamb": ["moving-blankets", "fits"],
  "furniture-slide": ["moving-blankets", "fits"],
  "ram-board": ["moving-blankets", "fits"],
  "carpet-protection": ["moving-blankets", "fits"],
  "floor-protection": ["moving-blankets", "fits"],
  "shoulder-dolly": ["moving-blankets", "fits"],
  "hand-truck": ["moving-blankets", "fits"],
  "hand-truck-cover": ["moving-blankets", "fits"],
  "lifting-strap": ["moving-blankets", "fits"],
  "corner-protector": ["packing-supplies", "fits"],
  "bubble-wrap": ["packing-supplies", "fits"],
  "stretch-wrap": ["packing-supplies", "fits"],
  newsprint: ["packing-supplies", "fits"],
  "kraft-paper": ["packing-supplies", "fits"],
  "corrugated-sheet": ["packing-supplies", "fits"],
  foam: ["packing-supplies", "fits"],
  tape: ["packing-supplies", "fits"],
  label: ["packing-supplies", "fits"],
  dispenser: ["packing-supplies", "fits"],
  knife: ["packing-supplies", "fits"],

  // stretches
  "mattress-bag": ["mattress", "loose"],
  "side-loader-box": ["bike", "loose"],
  "telescopic-box": ["artwork-mirror", "loose"],
  "speed-pack": ["moving-boxes", "loose"],
  "gondola-box": ["moving-boxes", "loose"],
  "sofa-box": ["moving-boxes", "loose"],
  "clock-box": ["moving-boxes", "loose"],
  "electronics-box": ["moving-boxes", "loose"],
  "corrugated-tote": ["storage-file", "loose"],
  crate: ["bulk-cargo-containers", "loose"],
  bin: ["bulk-cargo-containers", "loose"],
  "wine-box": ["moving-boxes", "loose"],
  dolly: ["moving-blankets", "loose"],
  pad: ["moving-blankets", "loose"],
  cover: ["moving-blankets", "loose"],
};

/** Category we'd need to add to cover a type that has no home. */
export const SUGGESTED = {
  strap: "Straps & Tie-Downs",
  winch: "Straps & Tie-Downs",
  "load-bar": "Cargo Control",
  "cargo-net": "Cargo Control",
  "cargo-hardware": "Cargo Control",
  ramp: "Ramps & Walkboards",
  "panel-cart": "Carts & Platform Trucks",
  "material-handling": "Material Handling",
  "piano-equipment": "Piano & Specialty Moving",
  "machine-moving": "Piano & Specialty Moving",
  safety: "Safety & PPE",
  bag: "Bags & Covers",
  unclassified: "Warehouse & Cargo Gear",
};

/** "fits" | "loose" | "none" for a product type. */
export function fitOf(type) {
  return MAP[type] ? MAP[type][1] : "none";
}

/** Category slug a type belongs to, or null. */
export function categoryOf(type) {
  return MAP[type] ? MAP[type][0] : null;
}

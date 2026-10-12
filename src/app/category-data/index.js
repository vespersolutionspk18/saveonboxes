import { movingCategories } from "../catalog";

import artworkMirror from "./artwork-mirror.json";
import bike from "./bike.json";
import bulkCargoContainers from "./bulk-cargo-containers.json";
import dishAndGlass from "./dish-and-glass.json";
import golf from "./golf.json";
import lamp from "./lamp.json";
import mattress from "./mattress.json";
import movingBlankets from "./moving-blankets.json";
import movingBoxes from "./moving-boxes.json";
import movingKits from "./moving-kits.json";
import packingSupplies from "./packing-supplies.json";
import roundTripTotes from "./round-trip-totes.json";
import storageFile from "./storage-file.json";
import tvBoxes from "./tv-boxes.json";
import wardrobe from "./wardrobe.json";

const raw = [
  movingBoxes,
  movingKits,
  packingSupplies,
  artworkMirror,
  golf,
  wardrobe,
  lamp,
  movingBlankets,
  tvBoxes,
  dishAndGlass,
  storageFile,
  bike,
  mattress,
  bulkCargoContainers,
  roundTripTotes,
];

/**
 * Uline card labels that map onto one of our own category pages. Keyed by the
 * label with everything but letters and digits stripped.
 */
const labelTargets = {
  movingboxes: "moving-boxes",
  movingkits: "moving-kits",
  packingsupplies: "packing-supplies",
  artworkmirror: "artwork-mirror",
  artworkmirrorboxes: "artwork-mirror",
  artmirrorboxes: "artwork-mirror",
  golf: "golf",
  golfboxes: "golf",
  wardrobe: "wardrobe",
  wardrobeboxes: "wardrobe",
  wardrobemovingboxes: "wardrobe",
  lamp: "lamp",
  lampboxes: "lamp",
  movingblanketspadsandsupplies: "moving-blankets",
  movingblankets: "moving-blankets",
  tvboxes: "tv-boxes",
  flatpaneltvboxes: "tv-boxes",
  flatpaneltvmovingboxes: "tv-boxes",
  dishandglass: "dish-and-glass",
  dishandglasspackboxes: "dish-and-glass",
  storagefile: "storage-file",
  storagefileboxes: "storage-file",
  bike: "bike",
  bikeboxes: "bike",
  mattress: "mattress",
  mattressboxes: "mattress",
  bulkcargocontainers: "bulk-cargo-containers",
  bulkcargo: "bulk-cargo-containers",
  roundtriptotes: "round-trip-totes",
};

const key = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Our own label for each slug, so the H1 matches the card the visitor clicked. */
const labelBySlug = Object.fromEntries(movingCategories.map((category) => [category.id, category.label]));

/** Where a card should link, if we already have a page for it. */
function cardTarget(name) {
  const slug = labelTargets[key(name)];
  return slug ? `/category/${slug}` : null;
}

const decorate = (page) => ({
  ...page,
  title: labelBySlug[page.slug] || page.title,
  featured: page.featured.map((card) => ({ ...card, to: cardTarget(card.name) })),
  items: page.items.map((card) => ({ ...card, to: cardTarget(card.name) })),
});

export const categoryPages = raw.map(decorate).sort((a, b) => a.title.localeCompare(b.title));

export const categorySlugs = raw.map((page) => page.slug);

export function getCategoryPage(slug) {
  return categoryPages.find((page) => page.slug === slug) || null;
}

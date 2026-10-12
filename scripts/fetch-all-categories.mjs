#!/usr/bin/env node
/** Fetch every category page. See fetch-uline-category.mjs for the modes. */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");

export const SOURCES = [
  ["moving-boxes", "https://www.uline.com/Grp_141/Moving-Boxes", "group"],
  ["packing-supplies", "https://www.uline.com/Grp_PackingSupplies/", "group"],
  ["moving-blankets", "https://www.uline.com/Grp_146/Moving-Blankets-Pads-and-Supplies", "group"],
  ["storage-file", "https://www.uline.com/Grp_116/Storage-File-Boxes", "group"],
  ["bulk-cargo-containers", "https://www.uline.com/Grp_351/Bulk-Cargo", "group"],
  ["moving-kits", "https://www.uline.com/BL_7907/Moving-Kits", "products"],
  ["artwork-mirror", "https://www.uline.com/BL_7901/Artwork-Mirror-Boxes", "products"],
  ["golf", "https://www.uline.com/BL_410/Tall-Boxes", "products"],
  ["wardrobe", "https://www.uline.com/BL_7902/Wardrobe-Boxes", "products"],
  ["lamp", "https://www.uline.com/BL_7905/Lamp-Boxes", "products"],
  ["tv-boxes", "https://www.uline.com/BL_7908/Flat-Panel-TV-Boxes", "products"],
  ["dish-and-glass", "https://www.uline.com/BL_7903/Dish-and-Glass-Pack-Boxes", "products"],
  ["bike", "https://www.uline.com/BL_413/Large-Side-Loaders", "products"],
  ["mattress", "https://www.uline.com/BL_429/Mattress-Boxes", "products"],
  ["round-trip-totes", "https://www.uline.com/BL_312/Round-Trip-Totes", "products"],
];

const only = process.argv.slice(2);
for (const [slug, url, mode] of SOURCES) {
  if (only.length && !only.includes(slug)) continue;
  try {
    const { stdout } = await run("node", [path.join(ROOT, "scripts/fetch-uline-category.mjs"), slug, url, mode], {
      cwd: ROOT,
      maxBuffer: 16 * 1024 * 1024,
    });
    process.stdout.write(stdout);
  } catch (err) {
    console.error(`${slug}: FAILED — ${err.message.split("\n")[0]}`);
  }
}

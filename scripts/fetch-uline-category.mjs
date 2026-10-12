#!/usr/bin/env node
/**
 * Pull one Uline category page into a local data file + images.
 *
 *   node scripts/fetch-uline-category.mjs <slug> <uline-url> <group|products>
 *
 *   group    - Uline group pages (Grp_*): renders the featured row plus the
 *              subcategory thumbnail grid, exactly like the reference design.
 *   products - Uline browse pages (BL_*): renders the product table and turns
 *              each row into a card (image + name + size + item number).
 *
 * Writes  src/app/category-data/<slug>.json
 *         public/categories/<slug>/*.webp
 */

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const IMG_QUERY = "?&wid=520&hei=520&qlt=88&op_usm=1,1,1";

/* ------------------------------------------------------------------ fetch */

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

/** Uline renders BL_* product tables client-side, so those need a real browser. */
async function fetchRendered(url) {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME}`);
  const { stdout } = await run(
    CHROME,
    ["--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--virtual-time-budget=20000", "--dump-dom", url],
    { maxBuffer: 64 * 1024 * 1024, timeout: 180000 },
  );
  return stdout;
}

/* ------------------------------------------------------------------ parse */

const ENTITIES = {
  amp: "&",
  quot: '"',
  apos: "'",
  nbsp: " ",
  gt: ">",
  lt: "<",
  reg: "®",
  trade: "™",
  copy: "©",
  deg: "°",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

const decode = (s) =>
  s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/\s+/g, " ")
    .trim();

const title = (html) => {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return m ? decode(m[1]) : null;
};

/** Every `<a>` that wraps an image and a `<p class="cg-caption">` label. */
function captionAnchors(fragment) {
  const out = [];
  const re = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(fragment))) {
    const cap = m[2].match(/<p class="cg-caption">([\s\S]*?)<\/p>/);
    const img = m[2].match(/<img[^>]*src="([^"]+)"/);
    if (cap && img) out.push({ name: decode(cap[1]), href: m[1], image: img[1] });
  }
  return out;
}

function parseGroup(html) {
  const featureStart = html.indexOf('class="groupfeature');
  const thumbsStart = html.indexOf('class="clsgrpthumbnails');
  let featured = [];
  let items = [];
  if (featureStart >= 0 && thumbsStart > featureStart) {
    featured = captionAnchors(html.slice(featureStart, thumbsStart));
    items = captionAnchors(html.slice(thumbsStart));
  } else if (thumbsStart >= 0) {
    items = captionAnchors(html.slice(thumbsStart));
  } else {
    items = captionAnchors(html);
  }
  return { featured, items };
}

const nameFromSlug = (slug) =>
  decode(slug.replace(/-/g, " ").replace(/(\d+)\s+x\s+(?=\d+)/g, "$1 × "));

function parseProducts(dom) {
  // Uline embeds clean product names in a data island; use it when present.
  const description = {};
  for (const m of dom.matchAll(/'ItemNumber':\s*'([^']+)',\s*'Description':\s*'((?:[^'\\]|\\.)*)'/g)) {
    description[m[1]] = decode(m[2]);
  }
  // Uline splits a browse page into several product tables: the main family
  // first, then either more of the same family or "related items" from other
  // categories. Prefer the first table when it is substantial; otherwise the
  // page is sectioned (e.g. dish packs / partitions / glass kits) and we need
  // every section to build a full grid.
  const MIN_PRODUCTS = 4;
  const tables = [...dom.matchAll(/<table[^>]*class="subgroupChart"[\s\S]*?<\/table>/g)].map((t) => t[0]);
  const productTables = tables.filter((t) => /\/Product\/Detail\/S-\d+\//.test(t));
  const first = productTables[0];
  const countIn = (t) => new Set([...t.matchAll(/\/Product\/Detail\/(S-\d+)\//g)].map((m) => m[1])).size;
  const scope =
    first && countIn(first) >= MIN_PRODUCTS ? [first] : productTables.length ? productTables : [dom];

  const rows = [];
  const seen = new Set();
  for (const table of scope) {
    for (const m of table.matchAll(/href="\/Product\/Detail\/(S-\d+)\/[^"]*?\/([^"?#]+)"/g)) {
      const [, sku, slug] = m;
      if (seen.has(sku)) continue;
      seen.add(sku);
      rows.push({
        name: description[sku] || nameFromSlug(slug),
        href: `https://www.uline.com/Product/Detail/${sku}`,
        sku,
        // Uline's image server resolves any item number directly, so we do not
        // have to find the <img> in the page markup.
        image: `https://img.uline.com/is/image/uline/${sku}`,
      });
    }
  }
  return { featured: rows.slice(0, 3), items: rows.slice(3) };
}

/* ----------------------------------------------------------------- images */

const imageUrl = (raw) => {
  if (!raw) return null;
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withProtocol.split("?")[0] + IMG_QUERY;
};

const slugify = (s) =>
  decode(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

async function downloadImage(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://www.uline.com/" } });
  if (!res.ok) throw new Error(`image ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

/* -------------------------------------------------------------------- run */

const [slug, url, mode] = process.argv.slice(2);
if (!slug || !url || !["group", "products"].includes(mode)) {
  console.error("usage: node scripts/fetch-uline-category.mjs <slug> <uline-url> <group|products>");
  process.exit(1);
}

const html = mode === "group" ? await fetchHtml(url) : await fetchRendered(url);
const parsed = mode === "group" ? parseGroup(html) : parseProducts(html);
const pageTitle = title(html) || slug;

// The reference layout has exactly three featured cards; anything Uline puts
// beyond that drops into the main grid. Very long source pages are capped so a
// single category cannot produce an unbounded page.
const MAX_CARDS = 28;
if (parsed.featured.length > 3) parsed.items = [...parsed.featured.slice(3), ...parsed.items];
parsed.featured = parsed.featured.slice(0, 3);
if (parsed.featured.length + parsed.items.length > MAX_CARDS) {
  parsed.items = parsed.items.slice(0, MAX_CARDS - parsed.featured.length);
}

const dir = path.join(ROOT, "public/categories", slug);
await mkdir(dir, { recursive: true });
await mkdir(path.join(ROOT, "src/app/category-data"), { recursive: true });

const out = { slug, title: pageTitle, source: url, mode, featured: [], items: [] };
let n = 0;
for (const [bucket, list] of [
  ["featured", parsed.featured],
  ["items", parsed.items],
]) {
  for (const card of list) {
    n += 1;
    const file = `${String(n).padStart(2, "0")}-${slugify(card.name) || "card"}.webp`;
    let saved = null;
    const src = imageUrl(card.image);
    if (src) {
      try {
        await downloadImage(src, path.join(dir, file));
        saved = file;
      } catch (err) {
        console.warn(`  ! image failed for "${card.name}": ${err.message}`);
      }
    }
    out[bucket].push({ name: card.name, image: saved, href: card.href || null, sku: card.sku || null });
  }
}

await writeFile(
  path.join(ROOT, "src/app/category-data", `${slug}.json`),
  JSON.stringify(out, null, 2) + "\n",
);

console.log(
  `${slug}: "${out.title}" -> featured=${out.featured.length} items=${out.items.length} images=${n - out.featured.filter((c) => !c.image).length - out.items.filter((c) => !c.image).length}`,
);

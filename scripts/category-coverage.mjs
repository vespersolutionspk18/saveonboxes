/**
 * Do our products fit inside the 15 Uline-derived categories?
 *
 * Assigns every product in our supplier catalogue to the best-fitting of the
 * 15 category pages we built, and reports which products have no home.
 *
 * Usage: node scripts/category-coverage.mjs
 * Writes: reports/category-coverage.json
 *         reports/4-category-coverage.csv
 *         reports/category-coverage.html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { typeOfRecord, dimsOf, dimLabel } from "./lib/taxonomy.mjs";
import { CATEGORIES, MAP, SUGGESTED, fitOf, categoryOf } from "./lib/categories.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

/* ------------------------------------------------------------------ *
 * Assign
 * ------------------------------------------------------------------ */

const catalog = read("src/app/supplier-catalog.json");
const ours = [];
for (const [key, list] of Object.entries(catalog)) {
  for (const p of list) {
    const blob = [p.category, p.additional_categories, p.product, p.details, p.variants]
      .filter(Boolean).join(" ");
    const type = typeOfRecord(p);
    const entry = MAP[type];
    ours.push({
      supplier: key,
      company: p.company,
      category: p.category,
      sku: p.sku,
      name: p.product,
      price: p.price,
      url: p.url,
      type,
      dims: dimLabel(dimsOf(blob)),
      fit: entry ? entry[1] : "none",
      assignedTo: entry ? entry[0] : null,
      suggested: entry ? null : (SUGGESTED[type] || "Warehouse & Cargo Gear"),
    });
  }
}

const byFit = (f) => ours.filter((o) => o.fit === f);
const fits = byFit("fits");
const loose = byFit("loose");
const none = byFit("none");

const group = (list, fn) =>
  [...list.reduce((m, x) => {
    const k = fn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
    return m;
  }, new Map())].sort((a, b) => b[1].length - a[1].length);

const perCategory = Object.keys(CATEGORIES).map((slug) => {
  const list = ours.filter((o) => o.assignedTo === slug);
  return {
    slug,
    title: CATEGORIES[slug],
    total: list.length,
    clean: list.filter((o) => o.fit === "fits").length,
    loose: list.filter((o) => o.fit === "loose").length,
  };
}).sort((a, b) => b.total - a.total);

const suggestedGroups = group(none, (o) => o.suggested);

const report = {
  generatedAt: new Date().toISOString(),
  counts: {
    total: ours.length,
    fits: fits.length,
    loose: loose.length,
    none: none.length,
    categories: Object.keys(CATEGORIES).length,
    categoriesUsed: perCategory.filter((c) => c.total > 0).length,
    categoriesEmpty: perCategory.filter((c) => c.total === 0).length,
    suggestedNewCategories: suggestedGroups.length,
  },
  perCategory,
  suggestedGroups: suggestedGroups.map(([name, list]) => ({
    name,
    count: list.length,
    types: [...new Set(list.map((o) => o.type))],
  })),
  homeless: none.map((o) => ({
    supplier: o.supplier, company: o.company, category: o.category,
    sku: o.sku, name: o.name, type: o.type, dims: o.dims,
    suggested: o.suggested, price: o.price,
  })),
  assignments: ours.map((o) => ({
    supplier: o.supplier, company: o.company, category: o.category,
    sku: o.sku, name: o.name, type: o.type, dims: o.dims,
    fit: o.fit, assignedTo: o.assignedTo ? CATEGORIES[o.assignedTo] : "",
    suggested: o.suggested || "",
  })),
};

fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "reports/category-coverage.json"), JSON.stringify(report, null, 2));

/* CSV ------------------------------------------------------------------ */

const csvCell = (s) => {
  const v = String(s ?? "");
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};
const csv = [
  ["Product", "SKU", "Supplier", "Supplier category", "Type", "Size", "Fit", "Category page", "Suggested new category"],
  ...report.assignments.map((a) => [
    a.name, a.sku, a.company, a.category, a.type, a.dims,
    a.fit === "fits" ? "Fits" : a.fit === "loose" ? "Stretch" : "No home",
    a.assignedTo, a.suggested,
  ]),
].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
fs.writeFileSync(path.join(ROOT, "reports/4-category-coverage.csv"), csv);

/* HTML ----------------------------------------------------------------- */

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (n) => ((n / ours.length) * 100).toFixed(1);

const catRows = perCategory.map((c) => `<tr>
  <td class="pn">${esc(c.title)}</td>
  <td class="num">${c.total}</td>
  <td class="num">${c.clean}</td>
  <td class="num">${c.loose}</td>
  <td class="bar"><span style="width:${((c.total / ours.length) * 100).toFixed(1)}%"></span></td>
</tr>`).join("");

const homelessRows = suggestedGroups.map(([name, list]) => `
  <section class="grp">
    <h3>${esc(name)} <span class="pill">${list.length} products</span></h3>
    <table class="simple"><thead><tr><th>Product</th><th>Supplier</th><th>Supplier category</th></tr></thead>
    <tbody>${list.map((o) => `<tr>
      <td class="pn">${esc(o.name)}</td>
      <td class="meta">${esc((o.company || "").replace(/ Moving Equipment$/, ""))}</td>
      <td class="meta">${esc(o.category)}</td>
    </tr>`).join("")}</tbody></table>
  </section>`).join("");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Category coverage — do our products fit?</title>
<style>
  :root { --ink:#14181d; --body:#2b3238; --muted:#6b7379; --line:#dfe3e6; --soft:#f6f8f9; --red:#b4291f; --green:#1c6b3f; --amber:#9a6207; }
  * { box-sizing:border-box; }
  body { margin:0; padding:48px 28px 90px; background:#fff; color:var(--body);
    font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased; }
  .wrap { max-width:1060px; margin:0 auto; }
  h1 { margin:0 0 6px; color:var(--ink); font-size:30px; letter-spacing:-.02em; }
  .sub { margin:0 0 32px; color:var(--muted); font-size:14px; }
  .answer { padding:20px 22px; border-radius:10px; background:#fdf2f1; border:1px solid #f2cfcb; margin-bottom:34px; }
  .answer b { display:block; color:var(--red); font-size:19px; margin-bottom:4px; }
  .answer p { margin:0; font-size:14px; }
  .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:44px; }
  .stat { padding:16px 18px; border:1px solid var(--line); border-radius:8px; background:var(--soft); }
  .stat b { display:block; font-size:28px; line-height:1.15; letter-spacing:-.02em; }
  .stat span { color:var(--muted); font-size:12.5px; }
  .stat.g b { color:var(--green); } .stat.a b { color:var(--amber); } .stat.r b { color:var(--red); }
  h2 { margin:48px 0 14px; padding-top:22px; border-top:2px solid var(--ink); color:var(--ink); font-size:21px; }
  table { width:100%; border-collapse:collapse; font-size:13.5px; }
  th { padding:7px 10px; border-bottom:1px solid var(--line); color:var(--muted); font-size:11px; font-weight:600; letter-spacing:.07em; text-transform:uppercase; text-align:left; }
  td { padding:8px 10px; border-bottom:1px solid #eef1f3; vertical-align:top; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; width:70px; }
  .bar { width:34%; } .bar span { display:block; height:7px; border-radius:4px; background:#c9d3da; }
  .pn { color:var(--ink); font-weight:500; }
  .meta { color:var(--muted); font-size:12.5px; }
  table.simple .pn, table.simple .meta { font-size:13px; }
  .grp { margin-bottom:26px; }
  h3 { display:flex; align-items:center; gap:10px; margin:0 0 8px; color:var(--ink); font-size:15.5px; }
  .pill { padding:2px 9px; border-radius:999px; background:var(--soft); border:1px solid var(--line); color:var(--muted); font-size:11.5px; font-weight:500; }
  footer { margin-top:52px; padding-top:20px; border-top:1px solid var(--line); color:var(--muted); font-size:12.5px; }
  @media (max-width:780px){ body{padding:28px 16px 60px;} .stats{grid-template-columns:1fr;} .bar{display:none;} }
</style>
</head>
<body>
<div class="wrap">
  <h1>Do our products fit the new categories?</h1>
  <p class="sub">Every product in our New Haven and CDS catalogue measured against the 15 category pages we built from Uline.</p>

  <div class="answer">
    <b>No — ${none.length} of ${ours.length} products (${pct(none.length)}%) have nowhere to go.</b>
    <p>A further ${loose.length} fit only loosely. ${fits.length} of ${ours.length} (${pct(fits.length)}%) land cleanly in one of the 15 categories.</p>
  </div>

  <div class="stats">
    <div class="stat g"><b>${fits.length}</b><span>fit cleanly</span></div>
    <div class="stat a"><b>${loose.length}</b><span>fit only loosely</span></div>
    <div class="stat r"><b>${none.length}</b><span>no home</span></div>
  </div>

  <h2>How the 15 categories fill up</h2>
  <table>
    <thead><tr><th>Category</th><th class="num">Total</th><th class="num">Clean</th><th class="num">Stretch</th><th>Share of catalogue</th></tr></thead>
    <tbody>${catRows}</tbody>
  </table>

  <h2>Products with no home</h2>
  <p class="meta" style="margin:0 0 22px">Grouped by the category we'd need to add to cover them.</p>
  ${homelessRows}

  <footer>
    Assignment is by product type, then mapped to the closest of the 15 categories.
    "Stretch" means the category is defensible but not a natural home.
    Full per-product assignment in <code>reports/4-category-coverage.csv</code>.
  </footer>
</div>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, "reports/category-coverage.html"), html);

console.log(JSON.stringify(report.counts, null, 2));
console.log("\n=== PER CATEGORY ===");
for (const c of perCategory) console.log(`${c.title.padEnd(34)} total ${String(c.total).padStart(3)}  clean ${String(c.clean).padStart(3)}  stretch ${String(c.loose).padStart(3)}`);
console.log("\n=== NO HOME, BY SUGGESTED CATEGORY ===");
for (const [name, list] of suggestedGroups) console.log(`${name.padEnd(34)} ${String(list.length).padStart(3)}  [${[...new Set(list.map((o) => o.type))].join(", ")}]`);

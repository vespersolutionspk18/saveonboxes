/**
 * Render reports/product-cross-reference.json into a readable HTML report and
 * three CSV lists.
 *
 * Usage: node scripts/build-comparison-report.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "reports/product-cross-reference.json"), "utf8"));

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const csvCell = (s) => {
  const v = String(s ?? "");
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";

const groupBy = (list, keyFn) =>
  [...list.reduce((m, x) => {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
    return m;
  }, new Map())].sort((a, b) => b[1].length - a[1].length);

const prettyType = (t) => t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ------------------------------------------------------------------ *
 * CSV exports
 * ------------------------------------------------------------------ */

const csvDir = path.join(ROOT, "reports");
fs.mkdirSync(csvDir, { recursive: true });

fs.writeFileSync(path.join(csvDir, "1-both-carry.csv"), toCsv([
  ["Uline product", "Uline SKU", "Uline category", "Uline type", "Uline size", "Match strength",
    "Our product", "Our SKU", "Our supplier", "Our size"],
  ...data.matched.flatMap((m) => {
    const best = m.sizeMatches.length ? m.sizeMatches : m.nearest.slice(0, 1);
    return best.map((o) => [
      m.uline.name, m.uline.sku || "", m.uline.category, prettyType(m.uline.type), m.uline.dims,
      m.confidence, o.name, o.sku || "", o.company || "", o.dims || "",
    ]);
  }),
]));

fs.writeFileSync(path.join(csvDir, "2-ours-only.csv"), toCsv([
  ["Our product", "Our SKU", "Supplier", "Our category", "Type", "Size", "Price", "URL"],
  ...data.oursOnly.map((o) => [
    o.name, o.sku, o.company, o.category, prettyType(o.type), o.dims, o.price, o.url,
  ]),
]));

fs.writeFileSync(path.join(csvDir, "3-uline-only.csv"), toCsv([
  ["Uline product", "Uline SKU", "Uline category", "Type", "Size", "Kind"],
  ...data.ulineOnly.map((u) => [
    u.name, u.sku || "", u.category, prettyType(u.type), u.dims, u.kind,
  ]),
]));

/* ------------------------------------------------------------------ *
 * HTML report
 * ------------------------------------------------------------------ */

const c = data.counts;

const matchedGroups = groupBy(data.matched, (m) => m.uline.type);
const oursOnlyGroups = groupBy(data.oursOnly, (o) => o.type);
const ulineOnlyGroups = groupBy(data.ulineOnly, (u) => u.type);

const strengthChip = (s) => {
  const map = {
    "exact-size": ["Same size", "ok"],
    "same-product": ["Same product", "ok"],
    adjacent: ["Adjacent", "warn"],
  };
  const [label, cls] = map[s] || [s, ""];
  return `<span class="chip ${cls}">${esc(label)}</span>`;
};

const matchedSection = matchedGroups.map(([type, list]) => {
  const note = list.find((m) => m.note)?.note;

  // Collapse Uline entries that map onto the same set of our products — a run
  // of ten totes pointing at one equivalent should be one row, not ten.
  const buckets = new Map();
  for (const m of list) {
    const eq = m.sizeMatches.length ? m.sizeMatches : m.nearest.slice(0, 3);
    const key = eq.map((o) => o.sku || o.name).sort().join("|") || "none";
    if (!buckets.has(key)) buckets.set(key, { ulines: [], eq, confidence: m.confidence, oursCount: m.oursCount });
    buckets.get(key).ulines.push(m.uline);
    // Exact-size rows are the strongest signal — let them win the bucket.
    if (m.confidence === "exact-size") buckets.get(key).confidence = "exact-size";
  }

  const rows = [...buckets.values()].map(({ ulines, eq, confidence, oursCount }) => {
    const ulineCell = ulines.length === 1
      ? `<span class="pn">${esc(ulines[0].name)}</span>
         <span class="meta">${esc(ulines[0].category)}${ulines[0].dims ? " &middot; " + esc(ulines[0].dims) : ""}${ulines[0].sku ? " &middot; " + esc(ulines[0].sku) : ""}</span>
         <span class="tag">${ulines[0].kind === "product" ? "product" : "category"}</span>`
      : `<span class="pn">${ulines.length} Uline entries</span>
         <ul class="eq tight">${ulines.slice(0, 6).map((u) => `<li><span class="pn sm">${esc(u.name)}</span></li>`).join("")}
         ${ulines.length > 6 ? `<li class="more">+${ulines.length - 6} more</li>` : ""}</ul>`;

    const eqHtml = eq.map((o) => `
      <li>
        <span class="pn">${esc(o.name)}</span>
        <span class="meta">${esc(o.company || "")}${o.dims ? " &middot; " + esc(o.dims) : ""}${o.sku ? " &middot; " + esc(o.sku) : ""}</span>
      </li>`).join("");

    return `<tr>
      <td>${ulineCell}</td>
      <td>${strengthChip(confidence)}<span class="count">${oursCount} of ours in this type</span></td>
      <td><ul class="eq">${eqHtml}</ul></td>
    </tr>`;
  }).join("");

  return `<section class="typeblock">
    <h3>${esc(prettyType(type))} <span class="pill">Uline ${list.length} &middot; ours ${list[0].oursCount}</span></h3>
    ${note ? `<p class="note">${esc(note)}</p>` : ""}
    <table class="cmp"><thead><tr><th>Uline</th><th>Match</th><th>Our equivalent</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}).join("");

const oursOnlySection = oursOnlyGroups.map(([type, list]) => `
  <section class="typeblock">
    <h3>${esc(prettyType(type))} <span class="pill">${list.length}</span></h3>
    <table class="simple"><thead><tr><th>Product</th><th>Supplier</th><th>Category</th><th>Size</th></tr></thead>
    <tbody>${list.map((o) => `<tr>
      <td class="pn">${esc(o.name)}</td>
      <td class="meta">${esc((o.company || "").replace(/ Moving Equipment$/, ""))}</td>
      <td class="meta">${esc(o.category)}</td>
      <td class="meta">${esc(o.dims)}</td>
    </tr>`).join("")}</tbody></table>
  </section>`).join("");

const ulineOnlySection = ulineOnlyGroups.map(([type, list]) => `
  <section class="typeblock">
    <h3>${esc(prettyType(type))} <span class="pill">${list.length}</span></h3>
    <table class="simple"><thead><tr><th>Product</th><th>Uline category</th><th>Size</th></tr></thead>
    <tbody>${list.map((u) => `<tr>
      <td class="pn">${esc(u.name)}</td>
      <td class="meta">${esc(u.category)}</td>
      <td class="meta">${esc(u.dims)}</td>
    </tr>`).join("")}</tbody></table>
  </section>`).join("");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Product comparison — Uline vs our catalogue</title>
<style>
  :root {
    --ink: #14181d; --body: #2b3238; --muted: #6b7379; --line: #dfe3e6;
    --bg: #fff; --soft: #f6f8f9; --accent: #b4291f; --ok: #1c6b3f; --warn: #9a6207;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 48px 28px 90px; background: var(--bg); color: var(--body);
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1120px; margin: 0 auto; }
  h1 { margin: 0 0 6px; color: var(--ink); font-size: 30px; letter-spacing: -.02em; }
  .sub { margin: 0 0 34px; color: var(--muted); font-size: 14px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 42px; }
  .stat { padding: 16px 18px; border: 1px solid var(--line); border-radius: 8px; background: var(--soft); }
  .stat b { display: block; color: var(--ink); font-size: 27px; line-height: 1.15; letter-spacing: -.02em; }
  .stat span { color: var(--muted); font-size: 12.5px; }
  .jump { display: flex; gap: 10px; margin: -22px 0 40px; }
  .jump a {
    display: flex; align-items: center; gap: 8px; padding: 9px 15px; border: 1px solid var(--line);
    border-radius: 7px; color: var(--body); font-size: 13.5px; text-decoration: none;
  }
  .jump a:hover { border-color: var(--ink); }
  .jump b { color: var(--ink); }
  .jump span { padding: 1px 7px; border-radius: 999px; background: var(--soft); color: var(--muted); font-size: 11.5px; }
  h2 { margin: 52px 0 4px; padding-top: 22px; border-top: 2px solid var(--ink); color: var(--ink); font-size: 21px; letter-spacing: -.01em; }
  h2 .n { color: var(--muted); font-size: 15px; font-weight: 400; }
  .lede { margin: 0 0 26px; color: var(--muted); font-size: 14px; max-width: 74ch; }
  .typeblock { margin-bottom: 30px; }
  h3 { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; color: var(--ink); font-size: 15.5px; }
  .pill { padding: 2px 9px; border-radius: 999px; background: var(--soft); border: 1px solid var(--line); color: var(--muted); font-size: 11.5px; font-weight: 500; }
  .note { margin: 0 0 10px; padding: 9px 12px; border-left: 3px solid var(--warn); background: #fdf8ee; color: #6d5312; font-size: 13px; border-radius: 0 4px 4px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th { padding: 7px 10px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 11px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; text-align: left; }
  td { padding: 10px; border-bottom: 1px solid #eef1f3; vertical-align: top; }
  .cmp td:first-child { width: 38%; }
  .cmp td:nth-child(2) { width: 16%; }
  .pn { display: block; color: var(--ink); font-weight: 550; }
  .meta { display: block; color: var(--muted); font-size: 12px; margin-top: 2px; }
  /* Long reference lists stay on one line per row. */
  table.simple td { padding: 5px 10px; }
  table.simple .pn, table.simple .meta { display: inline; margin: 0; font-size: 13px; }
  table.simple .pn { font-weight: 500; }
  table.simple td + td .meta, table.simple td.meta { color: var(--muted); }
  table.simple td:first-child { width: 42%; }
  .tag { display: inline-block; margin-top: 5px; padding: 1px 7px; border: 1px solid var(--line); border-radius: 3px; color: var(--muted); font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; }
  .count { display: block; margin-top: 6px; color: var(--muted); font-size: 11.5px; }
  .chip { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 600; }
  .chip.ok { background: #e8f3ec; color: var(--ok); }
  .chip.warn { background: #fdf3e2; color: var(--warn); }
  ul.eq { margin: 0; padding: 0; list-style: none; }
  ul.eq li { padding: 0 0 7px; }
  ul.eq li:last-child { padding-bottom: 0; }
  ul.eq.tight li { padding-bottom: 3px; }
  .pn.sm { font-weight: 450; font-size: 12.5px; color: var(--body); }
  li.more { color: var(--muted); font-size: 12px; font-style: italic; }
  footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12.5px; }
  @media (max-width: 780px) {
    body { padding: 28px 16px 60px; }
    .stats { grid-template-columns: repeat(2, 1fr); }
    .cmp td:first-child, .cmp td:nth-child(2) { width: auto; }
    table { font-size: 12.5px; }
  }
</style>
</head>
<body>
<div class="wrap">

  <h1>Uline vs our catalogue</h1>
  <p class="sub">Product-by-product comparison of the 15 Uline moving-box categories against our New&nbsp;Haven and CDS supplier catalogue. Generated ${esc(data.generatedAt.slice(0, 10))}.</p>

  <div class="stats">
    <div class="stat"><b>${c.ours}</b><span>products we carry</span></div>
    <div class="stat"><b>${c.ulineUnique}</b><span>Uline entries compared</span></div>
    <div class="stat"><b>${c.matchedUline}</b><span>Uline entries we match</span></div>
    <div class="stat"><b>${c.exactSizeMatches}</b><span>exact size matches</span></div>
  </div>

  <nav class="jump">
    <a href="#sec1"><b>1</b> Both carry <span>${c.matchedUline}</span></a>
    <a href="#sec2"><b>2</b> Ours only <span>${c.oursOnly}</span></a>
    <a href="#sec3"><b>3</b> Uline only <span>${c.ulineOnly}</span></a>
  </nav>

  <h2 id="sec1">1. We carry it, Uline carries it <span class="n">— ${c.matchedUline} Uline entries</span></h2>
  <p class="lede">Grouped by product type. "Same size" means a box of identical dimensions; "Same product" means we carry the product but not in that exact size; "Adjacent" means we have something in the same family that is not a direct equivalent.</p>
  ${matchedSection}

  <h2 id="sec2">2. We carry it, Uline doesn't <span class="n">— ${c.oursOnly} of our products</span></h2>
  <p class="lede">Our products whose type never appears anywhere in Uline's 15 moving-box categories. This is the bulk of our catalogue — it is weighted to moving equipment and cargo control rather than consumer cartons.</p>
  ${oursOnlySection}

  <h2 id="sec3">3. Uline carries it, we don't <span class="n">— ${c.ulineOnly} Uline entries</span></h2>
  <p class="lede">Uline product lines with no equivalent product type in our catalogue at all.</p>
  ${ulineOnlySection}

  <footer>
    <strong>How this was built.</strong> Uline's ${c.ulineRawRows} scraped rows collapse to ${c.ulineUnique} unique entries
    (${c.ulineProducts} product SKUs and ${c.ulineSubcategories} category links). Each side is classified into a product type,
    then compared on type, with physical dimensions used to confirm a match. ${c.ulineTypes} distinct Uline types vs ${c.oursTypes} of ours.
    <br>Regenerate with <code>node scripts/cross-reference.mjs &amp;&amp; node scripts/build-comparison-report.mjs</code>.
  </footer>

</div>
</body>
</html>
`;

fs.writeFileSync(path.join(csvDir, "product-comparison.html"), html);

console.log("Wrote:");
console.log("  reports/product-comparison.html");
console.log("  reports/1-both-carry.csv");
console.log("  reports/2-ours-only.csv");
console.log("  reports/3-uline-only.csv");

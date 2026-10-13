# Project memory — boxsave (SaveOnBoxes)

## Repo and pushing

- Remote: `https://github.com/vespersolutionspk18/saveonboxes.git` (branch `main`).
- Three GitHub accounts are logged into `gh` on this machine:
  - `EMDC-24` — read-only on this repo (403 on push).
  - `54thventuresinfo-byte` — read-only on this repo (403 on push).
  - `vespersolutionspk18` — the repo owner, has admin + push.
- Git uses `gh auth git-credential`, which follows the *active* gh account. As of
  2026-10-12 the active account is `vespersolutionspk18`, so a plain `git push` works.
- If a push 403s with `denied to <account>`, that account got switched back to active.
  Fix by switching rather than by token juggling:
  ```
  gh auth switch --user vespersolutionspk18
  git push origin main
  ```
- Per-command alternative (no global state change):
  ```
  GH_TOKEN=$(gh auth token --user vespersolutionspk18) git push origin main
  ```
- Commit author on this repo is `H <h@192.168.10.2>` (auto-derived, matches existing history).
  There is no repo-local `user.name` / `user.email` set.

## Ignore rules

`.gitignore` covers node_modules, .next, out, .vercel, *.log, .data, .env.local, .env.*.local.
The `.workbuddy-ai/` agent-memory folder is NOT ignored — deliberately kept out of commits.
Note: the user has since committed it themselves (commit `9b277a5` "t3"), so it may appear
in history even though agent runs do not stage it.

## Customer inventory UI (as of 2026-10-12)

- `/dashboard` is the single page: boxes render as collapsible `BoxCard`s (accordion, one open).
- Scan flow lands on `/dashboard?box=<id>`; `/dashboard/boxes/[id]` 307-redirects there.
- `BoxCard.js` holds the room plan (`RoomSelect`), editable inventory table, compact details, print sheet.
- `RoomSelect.js` creates rooms inline inside the dropdown — there is no separate "Add room" UI.
- `photo.js` holds the shared client-side image resize/compress helper.
- Item photos use a file input; the old in-app camera dialog was removed.

## Build gotcha

`npm run build` fails with `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]` when
`.next/turbopack` already exists from a previous build — Next tries to bulk-delete
its own cache and trips the sandbox guard. Fix: `rm -rf .next` first (this needs
escalation approval), then build. A clean build takes ~25-40s.

## Scraping Uline (network reality, 2026-10-13)

- **Node's built-in `fetch` cannot reach `www.uline.com`** — it fails with
  `getaddrinfo ENOTFOUND`. Node's DNS in this sandbox does not resolve it.
  `WebFetch` fails the same way.
- **`curl` works, but only through the local proxy** that is already exported as
  `HTTPS_PROXY` (`http://127.0.0.1:58923`). Direct curl returns 000.
- **The proxy is intermittent.** The same URL can return 200, then 502
  `Bad Gateway` on CONNECT, then 200 again seconds later. Roughly half of
  requests fail on any given attempt, so **everything must retry**.
- `img.uline.com` is much more reliable than `www.uline.com`, and its image
  server resolves any item number: `https://img.uline.com/is/image/uline/<SKU>`.
  It returns **JPEG**, not WebP — re-encode with sharp.
- Use `scripts/lib/uline-fetch.mjs` for everything. Do not call `fetch` directly.
- Headless Chrome with `--proxy-server` produced empty output; the raw HTML is
  enough anyway, because Uline's browse pages are server-side rendered.

### Uline page anatomy

- `Grp_*` — a group hub linking out to `BL_*` browse pages.
- `BL_*` — a browse page; the product table is `<table class="subgroupChart">`
  and each row links to `/Product/Detail/<SKU>/...`. A BL page is a *family*,
  its SKUs are the *variants*.
- `Product/Detail/S-*` — one SKU. Carries two data islands:
  - a schema.org **JSON-LD** block in a `<script type="application/ld&#x2B;json">`
    (note the `+` is HTML-escaped) with name, description, sku, image, colour,
    the `size` triple, `width`/`height`, and `offers` with both the per-unit
    price and the bundle price plus bundle quantity. **Parse the JSON before
    decoding entities** — Uline escapes embedded quotes as `&quot;`, and that is
    what keeps it valid.
  - a `dataLayer.push({ 'event': 'Product_Details', ... })` block carrying
    Uline's own taxonomy: `productClassDesc`, `productGroupDesc`,
    `productSubgroupDesc`, `productItemDesc`, `productPrice`.
- There is no `depth` field; the `size` triple is the reliable dimension source.

## Catalogue analysis tooling

- `scripts/lib/taxonomy.mjs` is the single source of truth for product
  classification (`typeOf`, `typeOfRecord`, `dimsOf`, `dimLabel`, `sameSize`,
  `sizeDistance`). Any script that needs to know "what kind of product is this"
  imports from here — do not re-implement the rules.
- Rule order in the exported `TYPES` array is load-bearing. `generic-box` must
  stay last or it swallows anything containing "box"/"carton".
- Classify our supplier records with `typeOfRecord()` (product name first,
  category as fallback) — supplier category labels are noisy.
- Reports live in `reports/` and are generated, not hand-edited:
  - `cross-reference.mjs` → `product-cross-reference.json`
  - `build-comparison-report.mjs` → `product-comparison.html` + 3 CSVs
  - `category-coverage.mjs` → `category-coverage.json` + HTML + CSV
- `/category/<slug>` subpages (15) are now built from `src/app/catalog-tree.js`,
  **not** from `src/app/category-data/*.json`. That folder is a stale separate
  scrape (205 cards, 88 of which we do not stock) and is no longer imported by
  anything — candidate for deletion, along with `public/categories/<slug>/`.
  `scripts/fetch-uline-category.mjs` belongs to that older pipeline.

## Storefront catalogue tree (2026-10-13)

- `src/app/supplier-catalog.json` holds `{ uline: [ ...446 records ] }`. Each
  record = one Uline SKU = one *variant*. `variants` is a human-readable string
  (`15 × 12 × 10" · White · 25 per bundle`), not an array; sibling variants are
  linked by `uline.family` (78 families, 53 with more than one variant).
  They are rendered as separate product cards, not grouped into a size picker.
- `src/app/supplier-products.js` maps each record onto the storefront's
  vocabulary. Every product carries `slug` (`s-4576`), `ulineCategorySlug`
  (the primary of the 15), `ulineTaxonomy`, `size`, `color`, `condition`,
  `priceValidUntil`, `variantLabel`, `bundlePrice`, `bundleQty`, `partial`.
- **`src/app/catalog-tree.js` is the single source of truth** for anything that
  needs the category/subcategory structure or a product lookup. Do not
  re-derive the tree elsewhere. Exports: `allProducts`, `categoryTree`,
  `getCategoryTree`, `getProductBySlug`, `subcategoryFor`, `subcategoryName`,
  `relatedProducts`, `imageFor`, `formatPrice`, `productSpecs`, `slugify`.
- Category = the 15 on the homepage (`movingCategories` in `catalog.js`).
  Subcategory = Uline's `subgroup`, trademark symbols stripped. 12 products have
  no taxonomy; for those the family is parsed from the product name
  (`"<family> - <variant>"`). 446 products → 15 categories → 74 subcategories.
- Routes: `/category/[slug]` (server component, no client JS, subcategory jump
  chips + one grid per subcategory) and `/product/[slug]` (446 SSG pages,
  `ProductBuyPanel` is the only client component).
- **Never call `formatPrice` / `productImage` / `productTitle` from
  `Storefront.js` inside a server component** — that file is `"use client"`, so
  those are client references. Use the equivalents in `catalog-tree.js`.
- `additional_categories` in the catalogue is a duplicate of `uline.subgroup`
  for all 446 records. Ignore it.
- `npm run start` binds `0.0.0.0`; use
  `npx next start --hostname 127.0.0.1 --port 3000` for a local preview.
  A server started with `nohup … &` inside a Bash call dies when that call
  returns — use the Bash tool's `run_in_background` instead.


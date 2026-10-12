# Project memory — boxsave (SaveOnBoxes)

## Repo and pushing

- Remote: `https://github.com/vespersolutionspk18/saveonboxes.git` (branch `main`).
- Two GitHub accounts are logged into `gh` on this machine:
  - `54thventuresinfo-byte` — currently the **active** account, but read-only on this repo (403 on push).
  - `vespersolutionspk18` — the repo owner, has admin + push.
- Git uses `gh auth git-credential`, which follows the *active* gh account, so a plain
  `git push` fails with `403 ... denied to 54thventuresinfo-byte`.
- Working push command (no global state change):
  ```
  GH_TOKEN=$(gh auth token --user vespersolutionspk18) git push origin main
  ```
- Commit author on this repo is `H <h@192.168.10.2>` (auto-derived, matches existing history).
  There is no repo-local `user.name` / `user.email` set.

## Ignore rules

`.gitignore` covers node_modules, .next, out, .vercel, *.log, .data, .env.local, .env.*.local.
The `.workbuddy-ai/` agent-memory folder is NOT ignored — deliberately kept out of commits.

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
- `/category/<slug>` subpages (15, Uline-derived) are built from
  `src/app/category-data/*.json`; see `scripts/fetch-uline-category.mjs`.

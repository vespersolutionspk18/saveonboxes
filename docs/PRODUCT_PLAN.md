# BoxSave Platform Product and Technical Plan

## Product

BoxSave adds a durable box-inventory service alongside the existing retail storefront. Customers buy scratch-covered QR labels through any sales channel, create an account with email, password, and phone number, then scan each revealed label while signed in. The first authenticated scan creates a numbered box in that account automatically. Box names are optional; rooms, contents, status, and notes can be edited later. A label is unique, permanently associated with one box/account after claiming, never expires, and is not reusable.

Customers can browse and search their boxes without scanning, find the room that contains a searched item, and print a complete master list. QR scans on an already claimed label open the owner's box after authentication. Other accounts receive no inventory disclosure and cannot claim it.

## Product flows

### Label production and sale

1. An authorized super administrator generates a bounded batch by requested quantity.
2. The application creates random, unguessable label tokens and serials in PostgreSQL, enforcing uniqueness.
3. The export service renders the exact issued records as print-ready SVG/PDF and/or a ZIP containing individual SVGs plus a batch manifest.
4. The physical QR is hidden by an opaque scratch layer. Serial text remains visible for support, but it cannot resolve to the secret URL publicly.
5. Reprints reuse the same token and are tracked. A preview/check mode records a manufacturing scan without claiming a label.

### Customer claim and use

1. Customer registers with email, password, and phone or logs in.
2. Customer attaches a label, scratches off its covering, and scans through the in-app camera or device camera.
3. For a logged-out browser scan, the app preserves the token through login and resumes automatically.
4. The authenticated app posts a claim request. The server transaction locks the label, checks status, allocates that user's next box number, creates the box, associates the label, and records the claim.
5. The customer chooses a destination room, adds inventory, and optionally supplies a box name, notes, and handling flags.
6. Later scans by the same account open the existing box. A different account gets a generic ownership/support message.

### Search, unpacking, and printing

Search spans item names, item notes, box names, and box notes within the authenticated account. Results include box number, item, room, and status. The master-list print view groups boxes by destination room and includes all contents and quantities. Records have no application expiry. Archiving hides a box from active work while retaining its records and reserving its number.

### Support and administration

The super-admin console manages accounts, labels, issuance batches, exports, scan analytics, claims, and support corrections. Corrections require a reason and create immutable audit events. Operations include assigning an unclaimed issued label directly to a customer, undoing an accidental empty claim, disabling/enabling compromised labels, and correcting an assignment while preserving historical boxes and inventory. Admin preview events are distinguishable from customer activity.

## Architecture

- Existing Next.js App Router application; preserve current storefront routes and data.
- Customer and super-admin UIs are separate route groups in the same Next.js application.
- Next.js Route Handlers provide the application HTTP API; no Express/Nest service is required.
- PostgreSQL on Neon is the authoritative store for users, sessions, labels, boxes, items, rooms, events, and audit data.
- SQL migrations are additive, versioned, tracked in a schema-migrations table, and safe to rerun. No destructive reset migration is allowed.
- Server-side service modules hold domain rules and SQL so pages, Route Handlers, and a future Express/Nest adapter can call the same implementation.
- PostgreSQL pooling must respect Neon pooler limits and deployment concurrency. Transactions use one checked-out client.
- `DATABASE_URL` is supplied only through an ignored local environment file for development; production uses deployment secrets.

## Core data model

- `users`: email, password hash, phone, role, lifecycle timestamps.
- `sessions`: hashed opaque session token, user, expiration, revocation metadata.
- `labels`: random token, human-readable serial, batch, state, optional claimed box, timestamps.
- `label_batches`: quantity, generation/export state, layout metadata, creator, timestamps.
- `boxes`: owner, label, account-scoped box number, optional name, destination room, status, notes, flags, archive timestamps.
- `rooms`: owner, name, optional display attributes.
- `box_items`: box, item name, quantity, notes, order, timestamps.
- `scan_events`: label, deduplication/event ID, event kind/source, account if authenticated, outcome, timestamp, privacy-safe operational metadata.
- `admin_audit_events`: acting administrator, action, target, old/new references, reason, timestamp.
- `rate_limit_buckets`: persistent counters for login, registration, claims, and support-sensitive actions.

Constraints enforce globally unique label tokens and serials, one permanent active box per label, unique box numbers per owner, and all ownership-scoped relationships. All reads and mutations resolve access from the authenticated server session.

## Authentication and security

Registration accepts only email, password, and phone as required customer fields. Passwords use a memory-hard password hash; sessions use high-entropy opaque tokens stored as hashes and delivered in HttpOnly, Secure-in-production, SameSite cookies. Login and registration receive rate limits. Mutating requests validate same-origin/CSRF protections. Password reset and verified contact flows require a configured delivery provider before production launch.

Super-admin access is never self-assigned through public registration. The initial operator is provisioned with a one-time environment-backed bootstrap command; subsequent role changes require an existing super-admin and audit record. No credentials, password hashes, session tokens, or QR tokens are logged. Sensitive admin routes verify role on every request.

QR identifiers contain at least 128 bits of cryptographic randomness. A normal page GET is read-only; claim happens through an authenticated POST after intentional page load or in-app camera detection, avoiding claims from link previews/prefetch. Claim operations are transactional and idempotent. Scan analytics describe recorded page opens/camera events; they are diagnostic data, not proof of purchase or ownership.

## Admin production and reporting

Admin batch creation accepts quantity with a server-enforced ceiling per request, validates required settings, inserts all labels transactionally or records a resumable job, and returns batch metadata. Exports support print-ready SVG, PDF sheets, and ZIP archives. The gift-card-sized layout defaults to 85.6 × 54 mm; layout controls cover margins, bleed, QR module quiet zone, serial, and optional writing fields. Exports include manifests and checksums; generated artifacts should have controlled access and retention.

Reporting includes total/available/claimed/disabled labels, accounts, boxes, scan events, daily claims/scans, claim conversion, batches, recent activity, per-label scan history, failures, and audited corrections. Customer identifiers are visible only to authorized admins. Reports are paginated and filterable.

## UI direction

Use shadcn/ui for new customer and admin application surfaces. Follow the product direction: compact, dense, data-driven, intuitive, simple, tight letter spacing, and no decorative single borders, horizontal separators, or dashed lines. Keep the existing retail storefront intact. Customer onboarding should present a single next action; box number is primary, name is optional, and destination room and inventory are easy to edit.

## Runtime and operations

Production requires HTTPS, managed secrets, database backups with recovery tests, structured redacted logs, error monitoring, alerting for database and export failures, and a stable QR domain with renewal monitoring. Large export jobs use bounded workloads and can move to a worker sharing PostgreSQL and the same service modules. Generated QR files are reproducible from the issued-label registry. Database restoration must be tested before the permanent-record promise is offered.

## Release and verification gates

Before selling labels: verify migration reruns, production build, registration/login/logout/session, role denial, concurrent and retried claims, cross-account privacy, ownership corrections, audit immutability, search, print output, bulk export integrity, QR readability beneath/after the scratch material, scan performance on several phones, backup restoration, and domain continuity. Seed/development-only admin access must not work in production.

## Open operational decisions

- Production hosting and its Node runtime, connection pooling, and request-duration limits.
- Email provider and password recovery/verification policy.
- Phone verification provider and whether it is required at signup.
- Physical printer's bleed, safe-area, stock, adhesive, and scratch coating specifications.
- Legal/privacy retention policy and support verification procedure for ownership disputes.
- Backup retention, recovery point, and recovery time objectives.

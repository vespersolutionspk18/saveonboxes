# Mobile and box-flow verification

The unified Next.js app is running at http://localhost:3000. The production build succeeds. The automated suite passed 38 tests; the live API suite passed 26 checks. Three final login API probes returned HTTP 200 in 4,990 ms, 2,617 ms, and 3,226 ms.

Browser checks covered 320, 390, and 430 px phones, 768 px tablet, and 1280 px desktop. Customer and admin QR scans continued through login to the correct box. Inline origin and destination room creation stayed on the same box. Both save buttons, optional room clearing, editable default names, one-item additions with commas, quantity/name edits, photo uploads/replacements, concurrent room/photo updates, search, master-list origin information, and accessible navigation dismissal were verified.

Print CSS specifies A4 with 15 mm margins and a dedicated plain box-details/inventory table. Native print preview could not be inspected in the in-app browser. Camera permission was not requested; scanner opening, dismissal, and its Camera-app fallback were checked.

The Claude frontend-design skill was installed from its official Anthropic source. See docs/MOBILE_REDESIGN.md for the design plan.

Screenshots and sanitized machine-readable checks are in this folder. Verification used disposable fixture accounts and labels; cleanup is recorded in fixture-cleanup.json.

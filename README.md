# GymBook

A browser-based management app for a gym or fitness studio: members, membership plans, attendance, payments and invoices, workout plans, follow-ups and reports.

Everything runs in the browser. There is no server, no account and no external API. Data is stored in the browser's IndexedDB.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the URL Vite prints (normally http://localhost:5173). On first launch you choose between loading a **labelled sample dataset** or starting empty.

Other scripts:

```bash
npm run build      # production build into dist/
npm run preview    # serve the production build
npm test           # unit tests (vitest + fake-indexeddb)
npm run test:e2e   # Playwright end-to-end tests (starts its own dev server on port 4173)
npm run test:volume  # load a large made-up gym and time every page (VOLUME_TIER=gym|busy|large|huge; minutes, not part of test:e2e)
npm run typecheck  # tsc
npm run lint       # oxlint
```

The first `test:e2e` run needs the Chromium browser once: `npx playwright install chromium`.

## Where data lives, and what that means

- All records are stored in **IndexedDB in this browser profile**, under the database name `gymbook`.
- Data does **not** synchronise between devices, browsers, or private windows. Two laptops at the front desk will have two separate datasets.
- Clearing site data in the browser deletes everything. Export a backup first (Settings → Backup).
- A JSON backup can be imported on another device. Import validates the file and shows a preview; it replaces all current data only after explicit confirmation, and leaves current data untouched when validation fails.
- **Google Drive backup (optional).** Settings → Google Drive backup signs in with Google and keeps one backup file in that account's hidden app folder in Drive. It needs a one-time setup by the site owner: [docs/GOOGLE-DRIVE-SETUP.md](docs/GOOGLE-DRIVE-SETUP.md). Until then the section says it is not set up and everything else works as before.
  - One file per Google account, replaced in place; unchanged data is not uploaded again; a backup counts as done only after Drive's size and checksum match what was sent.
  - Signing in never restores or uploads by itself. A backup found in the account is offered; restoring validates it, downloads a copy of the current data first, and reads the result back to compare.
  - Data that belongs to one Google account is never uploaded to another without an explicit confirmation.
  - It backs up automatically only while the app is open and signed in. It cannot run while the app is closed, and it is a backup, not sync: two devices do not merge their changes.
- Multiple tabs of the same browser share the database. Writes use an optimistic revision check, so a save based on a stale copy is refused with a clear message instead of silently overwriting another tab's change.

## What it covers

- **Front desk:** dashboard with money for the period and month-over-month trends; members with a unique member code (searchable at check-in), a photo taken with the device camera or uploaded, date of birth, gender, height, weight, fitness goal and health notes; a plan can be chosen on the Add member page, which saves the member, membership, invoice and first payment together; WhatsApp messages written for the member (welcome with plan, expiry date and amount paid; the invoice as text; a renewal reminder), offered right after a member is added and from the member and invoice pages. Each message can be sent in English or Marathi. GymBook opens WhatsApp with the text filled in and never sends anything itself; attendance; payments and invoices; follow-ups with an Upcoming expiries list (memberships ending in the next 7, 15 or 30 days, with call and WhatsApp links and a one-click follow-up).
- **Manage:** membership plans; workout plans from a built-in library or custom-built, assignable to members with a printable sheet.
- **Insights:** reports with CSV export and a printable summary, a filterable activity log, settings with backup and restore.

The training and operations areas were inspired by the feature set of the open-source GymSphere project (kasuncsb/Gym-Management-System, MIT), re-thought for a single-desk, browser-local app: no accounts, roles, server or AI chat.

## Branding

The build is branded for **R.K. Gym Fitness Centre**, Murbad (Thane): name, address, phone, the `RK` invoice prefix and the RK monogram logo live in `src/brand.ts` and are the defaults for a fresh install. The gym's Google Maps listing has no separate logo image, so a flat monogram was drawn in the red of the staff kit; `public/logo.svg` is the master and `node scripts/make-icons.mjs` regenerates the PNG app icons from it. Everything here can still be changed in Settings, and sample data no longer renames the gym.

## Deploying to GitHub Pages

Push the repository to GitHub and, under **Settings → Pages**, set the source to **GitHub Actions**. The workflow in `.github/workflows/pages.yml` runs the unit tests, builds with `BASE_PATH=/<repo>/` (or `/` for a `<user>.github.io` repository) and publishes `dist/`. The build is sub-path aware: Vite's `base`, the router's `basename`, the service worker scope and the manifest are all relative, and `404.html` is a copy of `index.html` so deep links work on a static host. To test the same thing locally: `BASE_PATH=/gymbook/ npm run build` and serve `dist/` under `/gymbook/`.

## Design system

The look was redesigned on 7 November 2026 with the Impeccable method: a product record in `PRODUCT.md`, a direction chosen from a dealt hand (`.impeccable/surfaces/`), and the shipped system documented in `DESIGN.md`. The earlier unslop-method direction (graphite neutrals, IBM Plex) was the previous world and is kept only in git history.

- **World:** the platform indicator board of a Mumbai suburban station, read every morning on the way to the gym. The home screen is the board: who is due next, in rupees or days, nearest first and brightest. Everything else is a plain, familiar front-desk tool.
- **Theme:** the dark board is the default (`:root`), chosen for a phone held at a gym desk; the light board (`data-theme="light"`) is the one opt-out, from the sidebar, the More drawer or the command palette. There is no system-follow mode.
- **Colour:** near-black ground, charcoal panels and hairlines, off-white ink. Signal colours each do one job and no screen may recolour them: red (`danger`) is money pending, amber (`warn`) is a plan ending within 7 days, green (`success`) is active and people in the gym right now, blue (`info`) is a plan that starts later. Crimson (`accent`) is the brand and the primary action only; it never marks a state. All roles are RGB triplets on `:root` in `src/index.css`, consumed through Tailwind (`bg-surface`, `text-muted`, `border-line`, …).
- **Type:** Barlow Semi Condensed (OFL, bundled via Fontsource) for every word of the interface at 400/500/600; Doto, a dot-matrix face, through the `.led` class for the signature numerals only: amounts due, days left, counts on the board and stat figures. Body 15 px, tables 14 px, page titles 30 to 36 px. Sentence case; the only uppercase is the small caption under a board numeral (PENDING, ENDING, LAPSED).
- **Surfaces:** solid, quiet chrome. Cards are a surface with a hairline (`.surface-card`); floating layers add one soft offset shadow (`.surface-pop`). Depth on the dark board comes from surface steps, not shadows. No gradients, glass or glows.
- **Spacing and radius:** a 4 px grid; radii 6 (tags, keycaps), 8 to 10 (controls, rows), 14 (cards, dialogs), 18 (palette, sheets). Board rows are at least 64 px tall; controls are 36 px on pointer devices and 44 px on touch screens (`.h-control`, via `pointer: coarse`).
- **Stats and charts:** a stat is a label, a figure and a line of context; the figure is an LED numeral. Charts are drawn at their real pixel width, bars fill their slot, labels stay 12 px, and one series carries colour.
- **Motion:** one easing curve, `cubic-bezier(0.22, 1, 0.36, 1)`; critically damped springs for sheets and dialogs, a 300 ms page-enter fade and rise, a 120 ms press scale. Nothing loops, layout properties are never animated, and all of it collapses under `prefers-reduced-motion`.
- **Components:** `src/components/ui` (Button, Field/Input/Select, Badge, Card, Table, Modal/bottom sheet, ConfirmDialog, Toast, Tabs, Stat, EmptyState, Skeleton, Pagination, Section, PageActions) and `src/components/domain` (member picker, membership and payment dialogs, check-in override).

### Mobile

Below 1024 px the sidebar is replaced by a bottom tab bar (Home, Members, Check in, Payments, More) with safe-area padding, and each page's actions sit under the page title as equal-width buttons, in the flow, so they never cover content. Tables become cards, dialogs become drag-to-dismiss bottom sheets, controls grow to 44 px and fields render at 16 px so iOS Safari does not zoom. The app ships a web manifest and home-screen icons, so it can be added to an iOS or Android home screen and opens standalone; scroll position is restored on back navigation.

### Offline

A production build registers a small service worker (`public/sw.js`) that caches the app shell and hashed assets, so an installed GymBook opens without a network connection. It never caches data; IndexedDB already lives on the device. The worker is not registered on the dev server.

### Keyboard shortcuts

`⌘K` / `Ctrl+K` or `/` opens the command palette (search members, jump to pages, run actions). `N` adds a member, `[` collapses the sidebar, `?` shows all shortcuts, and `G` followed by a letter jumps to a page (`G M` members, `G A` attendance, `G Y` payments, `G W` workout plans, …). Shortcuts are ignored while typing in a field or while a dialog is open.

## Architecture

```
src/
  domain/      Types, money (integer paise), date-only + timezone helpers,
               membership/invoice derivations, validation (zod), CSV escaping, metrics
  data/        IndexedDB schema (idb), transactional services, backup, sample data,
               drive/ (Google Drive client, backup rules, automatic backup),
               cross-tab change events (BroadcastChannel), fail-point for testing
  app/         Router, app context (settings, "today" in the gym timezone), shell
  components/  ui/ primitives (Button, Field, Modal/sheet, Toast, Table, …)
               domain/ dialogs and pickers that know about members/plans
  pages/       One file per screen
```

Rules that matter:

- **Money is integer paise.** Formatting happens only at the edges (`domain/money.ts`).
- **Membership dates are date-only strings** (`YYYY-MM-DD`) evaluated in the gym's timezone; attendance and payments are timestamps. "Today" comes from the configured timezone, never the device clock's local date.
- **Status is derived, never stored.** Active / expiring / expired comes from the dates (a member who has already renewed reads as active, not expiring: `memberMembershipState` in `src/domain/membership.ts`); paid / partly paid / unpaid comes from invoice total + adjustments − recorded payments. Nothing infers "paid" from "active".
- **Plan details are snapshotted** onto each membership and invoice line at sale time, so editing a plan later never changes what was sold.
- **Invoice numbers are allocated inside the same IndexedDB transaction** as the invoice, so they are unique and never reused.
- **Corrections are additive.** Payments and invoices are voided with a reason, and invoice totals are changed through adjustment records. History is kept.
- **Archiving** hides members and plans; it never deletes financial history.
- **Removed sections keep their data.** Trainers, PT sessions, Equipment and Expenses were taken out of the app, and the member form no longer asks for email, trainer or emergency contact. The IndexedDB stores and backup format still carry any such records made earlier, so old backups restore and nothing is deleted; the app just no longer shows them.
- **Repository/service boundary.** Pages call functions in `data/services/*`; those are the only code that opens transactions. Moving persistence to an HTTP API later means reimplementing that layer, not the pages.

## Reconstructed vs. observed

The brief supplied an Android package (`com.gymhelper.gymmanager`, GymBook 9.2.1) as a reference. What was actually observed from it, by static inspection only:

- Package identity and version, and that it is a React Native app using Hermes bytecode.
- Bundle string fragments mentioning membership, attendance, invoices, dashboard, expenses, trainers and subscriptions, plus an HTML invoice template fragment and a WhatsApp share module.

Everything else in this app, including every workflow, screen layout, data model, rule and the visual design, is an original reconstruction built from those feature leads and common gym-desk practice. It is **not** a replica of the original app, does not use its assets or code, and never contacts its servers.

## Limitations

- Browser-local only; no multi-device sync, no user accounts, no roles.
- Payments are **recorded**, not processed. There is no payment gateway.
- Attendance is manual (search and check in). There is no QR, card or biometric scanner.
- WhatsApp / email actions open the user's own apps with prefilled text; nothing is sent automatically.
- Currency is fixed to INR.
- Reduced-transparency and increased-contrast styles are implemented through CSS media queries and were verified by code only; reduced motion is covered by an end-to-end test. See `TEST-REPORT.md`.

# GymBook

A browser-based management app for a gym or fitness studio: members, membership plans, attendance, payments and invoices, trainers, expenses, follow-ups and reports.

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
npm run typecheck  # tsc
npm run lint       # oxlint
```

The first `test:e2e` run needs the Chromium browser once: `npx playwright install chromium`.

## Where data lives, and what that means

- All records are stored in **IndexedDB in this browser profile**, under the database name `gymbook`.
- Data does **not** synchronise between devices, browsers, or private windows. Two laptops at the front desk will have two separate datasets.
- Clearing site data in the browser deletes everything. Export a backup first (Settings → Backup).
- A JSON backup can be imported on another device. Import validates the file and shows a preview; it replaces all current data only after explicit confirmation, and leaves current data untouched when validation fails.
- Multiple tabs of the same browser share the database. Writes use an optimistic revision check, so a save based on a stale copy is refused with a clear message instead of silently overwriting another tab's change.

## What it covers

- **Front desk:** dashboard with today's sessions, equipment alerts and month-over-month trends; members with a unique member code (searchable at check-in), emergency contact, fitness goal and health notes; attendance; payments and invoices; follow-ups.
- **Training:** personal-training sessions between trainers and members with double-booking checks and roster hints, status tracking (scheduled, completed, cancelled, no-show); workout plans from a built-in library or custom-built, assignable to members with a printable sheet; trainers with weekly schedules.
- **Operations:** membership plans, equipment register with an incident workflow (open → in progress → resolved) that updates the machine's condition, expenses.
- **Insights:** reports with CSV export and a printable summary, a filterable activity log, settings with backup and restore.

The training and operations areas were inspired by the feature set of the open-source GymSphere project (kasuncsb/Gym-Management-System, MIT), re-thought for a single-desk, browser-local app: no accounts, roles, server or AI chat.

## Branding

The build is branded for **R.K. Gym Fitness Centre**, Murbad (Thane): name, address, phone, the `RK` invoice prefix and the RK monogram logo live in `src/brand.ts` and are the defaults for a fresh install. The gym's Google Maps listing has no separate logo image, so the monogram was drawn in the red of the staff kit; `public/logo.svg` is the master and `node scripts/make-icons.mjs` regenerates the PNG app icons from it. Everything here can still be changed in Settings, and sample data no longer renames the gym.

## Design system

- **Typography:** Inter Variable (OFL, bundled locally via `@fontsource-variable/inter`, no network fetch). Scale: 11 / 12 / 13 / 14 / 15 / 17 / 20 / 24 / 30 px with tightened tracking above 20 px.
- **Colour:** neutral canvas/surface/sunken/line tokens plus one emerald accent and semantic danger/warn/info tones, all defined as RGB triplets on `:root` in `src/index.css` and consumed through Tailwind (`bg-surface`, `text-muted`, `border-line`, …). Light and dark themes share the same token names; dark is applied with `data-theme="dark"` or follows `prefers-color-scheme` when no preference is stored. The theme toggle lives in the sidebar, the mobile drawer and the command palette.
- **Glass surfaces:** three translucent layers over a soft ambient colour wash (`body::before`, three radial gradients in accent, info and warm tones). `.glass` is the chrome (top bar, sidebar, tab bar), `.glass-card` is content cards and stat tiles, `.glass-pop` is overlays (dialogs, sheets, command palette, menus, toasts); each is more opaque than the last so text stays readable. The opacities and blur are tokens (`--glass-*-alpha`, `--glass-blur`) and collapse to solid surfaces under `prefers-reduced-transparency`, in browsers without `backdrop-filter`, and in print.
- **Spacing and radius:** Tailwind's 4 px grid; radii 8 / 10 / 14 / 18 / 24 px. Controls are 36 px on pointer devices and 44 px on touch screens (`.h-control`, via `pointer: coarse`).
- **Motion:** `motion` springs for sheets and dialogs, 200 ms page-enter fade, 100 ms press scale on pointer-down. All of it collapses to cross-fades or nothing under `prefers-reduced-motion`.
- **Components:** `src/components/ui` (Button, Field/Input/Select, Badge, Card, Table, Modal/bottom sheet, ConfirmDialog, Toast, Tabs, Stat, EmptyState, Skeleton, Pagination, Section, PageActions) and `src/components/domain` (member picker, membership/payment/trainer dialogs, check-in override).

### Mobile

Below 1024 px the sidebar is replaced by a bottom tab bar (Home, Members, Check in, Payments, More) with safe-area padding, and each page's primary action floats above it. Tables become cards, dialogs become drag-to-dismiss bottom sheets, controls grow to 44 px and fields render at 16 px so iOS Safari does not zoom. The app ships a web manifest and home-screen icons, so it can be added to an iOS or Android home screen and opens standalone; scroll position is restored on back navigation.

### Offline

A production build registers a small service worker (`public/sw.js`) that caches the app shell and hashed assets, so an installed GymBook opens without a network connection. It never caches data; IndexedDB already lives on the device. The worker is not registered on the dev server.

### Keyboard shortcuts

`⌘K` / `Ctrl+K` or `/` opens the command palette (search members, jump to pages, run actions). `N` adds a member, `[` collapses the sidebar, `?` shows all shortcuts, and `G` followed by a letter jumps to a page (`G M` members, `G A` attendance, `G C` PT sessions, `G Q` equipment, …). Shortcuts are ignored while typing in a field or while a dialog is open.

## Architecture

```
src/
  domain/      Types, money (integer paise), date-only + timezone helpers,
               membership/invoice derivations, validation (zod), CSV escaping, metrics
  data/        IndexedDB schema (idb), transactional services, backup, sample data,
               cross-tab change events (BroadcastChannel), fail-point for testing
  app/         Router, app context (settings, "today" in the gym timezone), shell
  components/  ui/ primitives (Button, Field, Modal/sheet, Toast, Table, …)
               domain/ dialogs and pickers that know about members/plans
  pages/       One file per screen
```

Rules that matter:

- **Money is integer paise.** Formatting happens only at the edges (`domain/money.ts`).
- **Membership dates are date-only strings** (`YYYY-MM-DD`) evaluated in the gym's timezone; attendance and payments are timestamps. "Today" comes from the configured timezone, never the device clock's local date.
- **Status is derived, never stored.** Active / expiring / expired comes from the dates; paid / partly paid / unpaid comes from invoice total + adjustments − recorded payments. Nothing infers "paid" from "active".
- **Plan details are snapshotted** onto each membership and invoice line at sale time, so editing a plan later never changes what was sold.
- **Invoice numbers are allocated inside the same IndexedDB transaction** as the invoice, so they are unique and never reused.
- **Corrections are additive.** Payments and invoices are voided with a reason, and invoice totals are changed through adjustment records. History is kept.
- **Archiving** hides members, plans and trainers; it never deletes financial history.
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

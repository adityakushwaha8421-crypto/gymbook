# GymBook test report

Date: 2026-10-28. Environment: macOS, Node 24, Chromium-based in-app browser at 320, 390, 768, 1024 and 1440 px.

## Redesign pass (same day, later)

The UI was redesigned on top of the same data layer: Inter typography, new neutral + emerald token set with light and dark themes, 36/44 px controls, collapsible sidebar, command palette (`⌘K`), keyboard shortcuts, skeleton loading states, page-enter transitions, header action slot, sectioned settings. All 20 unit tests and all 20 Playwright tests were re-run after the redesign and pass unchanged (the e2e selectors are role/label based, so they double as a regression check that no workflow broke). Screens were re-inspected in the in-app browser in light and dark themes at desktop width and at 390 px, including the mobile drawer, the bottom-sheet dialog and the command palette.

## Mobile pass

Added a bottom tab bar, floating page actions, touch-sized controls (verified under touch emulation: inputs 44 px tall at 16 px, primary buttons 44 px), safe-area padding, scroll restoration, manifest and icons. Re-swept every route at 320 px under the same no-overflow check (all pass, `scrollX` max 0) and re-inspected dashboard, members, plans, the More drawer and a bottom-sheet form at 375 px. Both suites re-run afterwards.

## Training and operations features (same day, later)

Added member profile fields and member codes (database version 2 with an upgrade that back-fills codes), PT sessions with conflict checks, equipment with an incident workflow, workout plans with a built-in library and printable sheets, an activity log page, dashboard trend and operations cards, grouped navigation, a printable report summary and an offline service worker (production builds only).

- Unit: 5 new service tests (member codes and code search, session double-booking and adjacency, incident lifecycle and equipment condition, template copy and assignment, backup round-trip of the new stores).
- E2E: `e2e/features.spec.ts` covers profile entry and check-in by code, booking with a refused overlap and completion visible on trainer and member pages, the full incident lifecycle with dashboard alerts, template use with assignment and the personalised print sheet, and the activity filter plus a 390 px overflow sweep of the new pages.
- The existing suites were re-run after the schema change; selectors that became ambiguous (a second "Notes" field, a "Workout plans" nav entry, the labelled member picker) and counts that grew (palette commands, backup stores, counters) were updated in the exploratory specs.
- Offline: verified in headless Chromium against the production build that the worker registers, precaches the shell and 53 assets, and that `/members` loads with the network disabled. The desktop app's embedded browser refuses to fetch worker scripts, so that check was not possible there.

| Suite | Result |
| --- | --- |
| Vitest | 124 passed |
| Playwright main + features | 25 passed |
| Playwright exploratory: members / money / ops / shell | 32 / 14 / 10 / 28 passed |
| Typecheck, lint, build (with service-worker precache step) | clean |

## Exploratory bug hunt (parallel agents, same day)

Five agents attacked the app in parallel: members data entry, money flows, operations screens, settings/shell/accessibility/responsive, and a unit-level audit of the domain and data layer. They left their work in place so it can be rerun:

- `e2e/explore/members.spec.ts`, `money.spec.ts`, `ops.spec.ts`, `shell.spec.ts` (Playwright, run one file at a time with `--output <own dir>`; they share the 4173 dev server)
- `src/domain/audit.test.ts`, `src/data/audit.test.ts` (vitest; 98 extra cases)

### Bugs found and fixed

High
- Browser Back on an edited form, then "Discard changes", re-opened the dialog forever (the guard reset a stale blocker after `proceed()`). `DiscardGuard.tsx`
- Loading sample data failed whenever a real invoice existed (hard-coded `INV-00001…`), and reloading it rewound the invoice counter so every later sale failed. Sample numbering now continues from the stored counter and prefix, and the counter never goes backwards. `data/sample.ts`

Medium
- Voiding an invoice left its membership active (check-in still allowed). The membership is now marked cancelled with the reason, excluded from current/renewal logic, and shown as "Cancelled". `services/payments.ts`, `domain/membership.ts`
- "Outstanding" had three definitions (dashboard per member, Payments and Reports per invoice). All now use one member-level definition that applies unlinked credits and excludes archived members. `domain/metrics.ts`
- Attendance history and the period pickers accepted inverted date ranges (empty results, misleading headers); ranges are normalised. `Attendance.tsx`, `PeriodPicker.tsx`
- Switching a follow-up from a member type to "lead" kept the stale member (list showed the member, not the lead). Irrelevant fields are stripped on save. `validation.ts`
- Reschedule accepted an empty date and stored `dueDate: ""`. Validated in the dialog and the service. `FollowUps.tsx`, `services/followups.ts`
- `/payments?action=record` focused the picker before it existed (timer race); it now focuses once data has loaded. `Payments.tsx`
- Member search dropped keystrokes when typing fast (input controlled by the URL); the box is local state and the URL follows. `Members.tsx`
- Phone numbers starting with "(" were refused; joining dates had no bounds (2999 and 1900 accepted). `validation.ts`
- Schedule times accepted `25:00` / `09:60`, and `formatMinutes(1440)` rendered 12:00 pm. `validation.ts`, `dates.ts`
- Toasts covered the bottom tab bar on phones; on small screens they now appear under the header. `Toast.tsx`
- Command palette did not return focus to its opener and Tab could leave it. `CommandPalette.tsx`
- Member picker had no accessible label; faint text failed WCAG AA contrast (2.8:1 light, 3.7:1 dark; now 4.7:1 and 5.5:1). `MemberPicker.tsx`, `index.css`
- `parseRupees` accepted totals beyond the safe-integer range; plan price now capped at ₹100 crore. `money.ts`, `validation.ts`
- Default invoice issue date in the service used the UTC date rather than the gym's date (the UI always passed the right date). `services/memberships.ts`

Low
- Raw zod messages for over-long text and durations; "1 recorded payments" pluralisation; form-level errors lingering after edits; footer Cancel bypassing the unsaved-changes guard in dialogs; Reset dialog keeping the typed "RESET" after Cancel; developer fail-point UI never re-arming; `theme-color` not synced at boot; `G`+letter chord broken when Shift was held; ⌘K opening the palette over another dialog; "Other" follow-ups labelled "Lead"; negative numbers in CSV exported as text; CSV timestamps exported in UTC rather than gym time; IndexedDB uniqueness errors surfacing as a raw browser message.

### Final state after fixes

| Suite | Result |
| --- | --- |
| Vitest (domain + data, incl. 98 audit cases) | 119 passed |
| Playwright main workflows | 20 passed |
| Playwright exploratory: members / money / ops / shell | 32 / 14 / 10 / 28 passed |
| Typecheck, lint, production build | clean |

The exploratory specs were updated where they had encoded the old behaviour (inverted ranges, per-invoice outstanding, UTC CSV timestamps, the uncapped price) and their "expected to fail" probes were promoted to ordinary tests.

### Judged as design choices, left as is
- Month plans starting on the 29th–31st end on the day before the same date next month after clamping (31 Jan → 27 Feb), which is documented in the sell dialog. A product decision could prefer "end of next month".
- Phone numbers starting with "+" are still apostrophe-escaped in CSV (a real formula risk in spreadsheets).
- `?page=99` is clamped but the URL keeps the typed value.

## Automated

`npm test` — 20 tests in 2 files, all passing.

- `domain/domain.test.ts`: inclusive end-date arithmetic for month and day plans, month clamping (31 Jan + 1 month), timezone "today" and start-of-day instants, rupee parsing/formatting round-trips, CSV formula escaping, membership state from dates, invoice balance (partial, void payment, adjustment) and that paid is never inferred from active.
- `data/services.test.ts` (fake-indexeddb): sale → partial payment → overpayment refused → balance paid; sequential invoice numbers across renewals; plan snapshot survives plan edit; idempotency key collapses a double submit into one invoice; void payment + adjustment keep history; attendance (no membership → `MembershipRequiredError`, override with reason, duplicate open check-in refused, check-out, stale revision refused); archive keeps invoices and payments and blocks new sales; stale-revision update refused (two-tab simulation); simulated storage failure writes nothing; backup round-trip, invalid backup rejected with data untouched, invoice counter advanced after import; sample data seeds labelled records and removal leaves real records; trainer schedule overlap rejected.

`npm run test:e2e` — 20 Playwright tests in `e2e/workflows.spec.ts`, all passing in headless Chromium against a fresh dev server (each test starts from an empty browser context, so IndexedDB is clean, and completes onboarding through the UI). They cover: sale with partial payment → balance paid → print-media layout; overpayment refused with the outstanding amount; renewal start/end dates computed independently with the domain date helpers and invoice issued on the sale date; check-in, duplicate refused, check-out, no-membership override with a required reason; archive keeps invoices/payments and hides sale actions; invalid and non-JSON backups rejected with data counts unchanged; two tabs editing one member (second save refused, edits kept, "load latest" works); simulated save failure keeps the form and retry succeeds; double-click creates one record; dashboard money and counts match an independent recomputation from IndexedDB; empty-period reports show zeros and the members CSV escapes a formula-like name; no horizontal scroll on every screen at 320, 390, 768, 1024 and 1440 px; phone drawer, bottom sheet with close button, focus trap over 20 Tab presses, Escape, focus returned to the opener; `prefers-reduced-motion` zeroes the press scale and dialogs still open/close; unsaved-edit guard, branded 404, Back/Forward; duplicate phone warns without blocking.

Bugs found by the end-to-end suite and fixed: a failed request stayed in the idempotency map for five seconds so an immediate retry re-threw the old error; the check-in idempotency key was time-bucketed so a duplicate attempt within three seconds reported success; the chart's screen-reader-only data table was 300 px wide and caused a 10 px horizontal scroll on Reports at 320 px.

`npm run typecheck` clean. `npm run build` succeeds; pages are code-split (main chunk ≈ 396 kB minified, pages 3–9 kB each).

## Browser workflows executed interactively (before the Playwright suite existed)

| Workflow | Result |
| --- | --- |
| Add member (duplicate phone warning shown, non-blocking) → sell Monthly plan with ₹500 partial payment → invoice INV-00015 "Partly paid", balance ₹1,000 → record ₹1,000 from invoice page → "Paid", balance ₹0, both payments listed | Pass |
| Renew: default start "After current plan" = day after current end (28 Nov) → end 27 Dec 2026 (inclusive), explanation text shown, invoice INV-00016 | Pass (found and fixed: invoice issue date used the future start date; now the sale date) |
| Attendance: keyboard-select member in combobox → check in → second check-in refused ("already checked in") → check out, duration recorded | Pass |
| Archive member: invoices, payments, memberships and visits still listed; "Archived" badge; sell/check-in actions hidden | Pass |
| Import invalid backup (missing member / invoice references): preview lists errors, nothing replaced | Pass |
| Two tabs editing the same member: tab A saves; tab B keeps its typed edits, shows "Changed in another tab", its save is refused with a conflict message; tab A's value is what is stored | Pass (found and fixed: form previously remounted on remote change and lost edits) |
| Simulated save failure (Settings → Developer tools) on Add expense: error shown inside the dialog, amount preserved, retry succeeds | Pass |
| Dashboard totals vs. raw IndexedDB: cash received, invoiced, expenses, net cash, outstanding, active members, attendance today recomputed independently in the page and matched | Pass |
| Every screen at 320 / 390 / 768 / 1024 / 1440: no element wider than the viewport, no horizontal page scroll (`scrollX` max 0) | Pass (found and fixed: unwrapped toolbars at 320, card-header tab strips and a grid column not shrinking at 390) |
| Dialog on phone width renders as bottom sheet with visible close button; focus starts on first control; Tab stays inside; Escape closes; focus returns to opener | Pass (found and fixed: focus restore after close) |
| Direct links, Back/Forward (history-driven navigation used in the sweep), unique titles per page, 404 page with home link | Pass |

## Verified by code inspection only (not exercised in a browser)

- `prefers-reduced-transparency` and `prefers-contrast: more` token overrides.
- The actual `window.print()` dialog; the print-media layout itself is asserted by the e2e suite via `emulateMedia`.
- Drag-to-dismiss on the mobile sheet (pointer capture, rubber-banding at the top, velocity threshold) — implemented with motion's drag controls from the sheet handle; a real touch device was not available.
- Photo/logo downscaling (`createImageBitmap` + canvas), WhatsApp/mailto links.

## Known gaps

- The e2e suite runs in Chromium only; WebKit and Firefox projects are not configured.
- The React Compiler lint reports two memoization advisories in `MembershipDialog.tsx`; they do not affect behaviour.
- Dark mode is not implemented (light theme only, by design for this version).

## Glass UI pass (2026-10-28)

Visual refresh only: ambient colour wash plus three translucent surface layers (`.glass`, `.glass-card`, `.glass-pop`), larger radii, lighter borders, softer shadows. No data or behaviour changes.

| Suite | Result |
| --- | --- |
| Vitest | 124 passed |
| Playwright main + features + shell exploratory | 53 passed (2 reran after fixes below) |
| Typecheck, lint, build | clean (lint warnings unchanged) |

Findings fixed during the pass:

- Light-mode `--c-faint` fell to 4.45:1 on the new canvas; darkened to 102 103 110 (5.16:1 on canvas, 4.98:1 on sunken).
- Theme exploratory test asserted the old canvas colours and `theme-color` meta; updated to the new tokens.
- Tab strip showed a horizontal scrollbar on phones; hidden with `.scrollbar-none`.

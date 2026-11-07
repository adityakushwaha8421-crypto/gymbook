# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner of R.K. Gym Fitness Centre in Murbad (Thane), working alone at the front desk. Confirmed 7 Nov 2026: the app runs mostly on their phone, with a laptop now and then; no staff account is needed. They are not a technical user and write in Hinglish; the interface is in English with WhatsApp messages in English and Marathi.

## Product Purpose

GymBook is the gym's front-desk book: members, their membership plans and expiry, fees and invoices, daily check-ins, follow-ups, workout sheets, reports. It replaces a paper register and a WhatsApp group. Success is that the owner can, in a few seconds on a phone, see who owes money, record a payment, check someone in, and know whose plan is ending.

The most frequent job, confirmed by the owner: collecting fees and seeing who is due. Check-in and expiry follow-up come next.

## Positioning

Everything lives in the browser on the owner's own device, with no account, server or subscription; one hidden backup file in the gym's own Google Drive. Nothing is sent anywhere else. Money is recorded, not processed.

## Operating Context

- A single desk in a working gym: noisy, people waiting, often one-handed on a phone. Decisions are made at a glance; entry must be quick and forgiving.
- Indian context: amounts in rupees, phone numbers as member identity, WhatsApp as the channel for reminders and receipts, monthly/quarterly plans, cash and UPI.
- Data is browser-local (IndexedDB). No sync between devices; Google Drive backup replaces one file in place and runs only while the app is open.
- The live site is a GitHub Pages deployment; the same build is used on phone and laptop.

## Capabilities and Constraints

- Members (photo, phone, plan, profile), membership plans, memberships with derived status (active / expiring / expired / starts later), invoices and payments with voids and adjustments, attendance with check-in/out, follow-ups and upcoming expiries, workout plans with printable sheets, activity log, reports with CSV and print, settings, JSON backup, Google Drive backup.
- Removed on purpose (6 Nov 2026) and not to be reintroduced unasked: trainers, PT sessions, equipment, expenses, member email, emergency contact.
- Rules the UI must respect: money is integer paise formatted at the edge; membership dates are date-only in the gym timezone; status is derived, never stored; corrections are additive (void with reason, adjustments); invoice numbers are unique and allocated transactionally; sample records carry a visible "Sample" label.
- Works offline once loaded (service worker). Volume-tested to 10,000 members; the gym itself has a few hundred at most.
- Undecided: whether automatic Drive backup should run less often or keep photos in a separate file (owner has not chosen).

## Brand Commitments

- Name: R.K. Gym Fitness Centre, Murbad Road Highway, Murbad, Thane 421401, phone 098920 80444. Invoice prefix `RK`.
- Logo: a flat "RK" monogram with a barbell, in the red of the gym's staff kit (`public/logo.svg`, `src/brand.ts`). The red is the only brand colour the gym has; it has no other identity assets.
- Voice: plain, direct English in sentence case; no marketing tone; honest about limits (for example "GymBook does not process payments").

## Evidence on Hand

- Real gym data exists only on the owner's devices (two members at the time of writing). The repository ships a labelled sample dataset (`src/data/sample.ts`) for exploring.
- The gym's Google Maps listing supplied the name, address and phone; it has no logo image.
- No testimonials, pricing, customer counts or press exist and none may be invented.

## Product Principles

1. The fee comes first: who owes, how much, and the action to record it sit closest to hand.
2. One-glance truth: status is derived and shown with its reason (dates, amounts), never a vague badge.
3. Forgiving entry: every save can be corrected additively; nothing is silently overwritten.
4. Phone-first, desk-ready: the same screens work one-handed on a phone and dense on a laptop.
5. Nothing leaves the device without an explicit choice.

## Accessibility & Inclusion

Touch targets of 44 px on touch screens, 16 px inputs on iOS, visible focus, reduced-motion and increased-contrast support are already in place and must be kept. The owner reads English but thinks in Hindi/Marathi, so labels stay short and concrete, and member-facing messages exist in Marathi.

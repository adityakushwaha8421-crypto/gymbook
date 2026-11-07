---
version: 1
slug: "src-pages-dashboard-tsx"
primary_target: "src/pages/Dashboard.tsx"
related_targets: ["src/app/Shell.tsx","src/index.css"]
---

# Surface: GymBook home and app shell (phone first)

Scope: the whole app shell and the home screen, redesign of the visual world; every other page inherits it. Visitor mode: Operate.

Audience and job: the gym owner, alone at the desk, on a phone, one-handed; the job is to see who owes and who is ending, record a payment, check someone in. Content: real members, memberships, invoices, payments and visits from IndexedDB; the sample dataset in development. Constraints: all existing routes, controls, data rules and accessibility (44 px touch, 16 px inputs, reduced motion, contrast) stay; English UI, sentence case; brand red stays the primary-action colour; light theme stays available.

Chosen direction: Platform Indicator Board (assigned by the roll, confirmed by the owner delegating the choice on 7 Nov 2026). Memorable moment: the Due-next board on the home screen with LED numerals, nearest burning red.

Unresolved: whether the owner prefers the dark shell by default at a sunlit desk; the theme toggle keeps light available and the decision is theirs after use.

## Direction contract

THESIS: The home screen is the platform indicator board the owner reads every morning: who is due next, in rupees or days, nearest first and brightest. It refuses the category arrangement of four equal stat cards above a chart.

OWN-WORLD: Near-black board ground (#0c0e11) with charcoal panels (#15191f, #1b2028) and hairlines (#242a33); off-white ink (#edf1f4), muted (#a3adb9). Signal colours do jobs only: LED red (#ff3b2f) for money pending/overdue, amber (#ffb020) for ending soon, green (#2fd36a) for active and people in the gym, blue (#5aa9ff) for starts later; brand crimson (#c81e2e) only for primary actions. Type: Barlow Semi Condensed for all UI; Doto (dot-matrix) only for the signature numerals (amounts due, days left, counts on the board and stat figures). Density: 52 px rows, 8 px grid, numerals right-aligned on one column. Light theme translates the same roles to a cool light board. Standard web controls throughout.

STORY: The owner opens the app, reads the board, taps the row that is due, records the payment, and the row clears.

FIRST VIEWPORT (390×844): compact header (logo, gym name, date); heading "Due next · N"; the Board panel: up to six rows, each name + reason line on the left and an LED numeral block on the right (₹2000 PENDING in red, 3 d ENDING in amber, later rows off-white); under it three totals (received today, visits today, in the gym with the live dot); fixed primary button "Record payment" above the standard bottom tabs. Desktop: the board leads a two-column grid with money and activity beside it.

FORM: Platform indicator board, position 6 on the ordered list of seven grounded directions (fee register, gym whiteboard, cricket scorecard, kushti fight card, hand-painted signage, indicator board, mark sheet). seed:3bbdaf348ae48e52.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

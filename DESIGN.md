---
name: GymBook
description: The platform indicator board for a one-person gym desk; near-black board, hairline panels, signal colours that each do one job, dot-matrix numerals for what is due.
colors:
  board-deep: "#090b0e"
  board-canvas: "#0c0e11"
  panel-surface: "#15191f"
  panel-raised: "#1b2028"
  panel-sunken: "#101318"
  ink: "#edf1f4"
  ink-muted: "#a3adb9"
  ink-faint: "#808b98"
  hairline: "#242a33"
  hairline-strong: "#3c4450"
  crimson: "#c81e2e"
  crimson-hover: "#e02e3e"
  crimson-soft: "#3a141a"
  crimson-ink: "#ff808a"
  crimson-fg: "#ffffff"
  signal-red: "#ff483a"
  signal-red-soft: "#401816"
  signal-amber: "#ffb020"
  signal-amber-soft: "#3a2c0c"
  signal-green: "#2fd36a"
  signal-green-soft: "#0e301e"
  signal-blue: "#60aaff"
  signal-blue-soft: "#142640"
  light-board-deep: "#e2e6ec"
  light-board-canvas: "#eceff3"
  light-panel-surface: "#ffffff"
  light-panel-sunken: "#f3f5f8"
  light-ink: "#10141a"
  light-ink-muted: "#525c6a"
  light-ink-faint: "#606a78"
  light-hairline: "#dee2e8"
  light-hairline-strong: "#c2c8d2"
  light-crimson-hover: "#aa1626"
  light-crimson-soft: "#fde8ea"
  light-crimson-ink: "#9e1222"
  light-signal-red: "#c62218"
  light-signal-red-soft: "#fee8e4"
  light-signal-amber: "#8c5a00"
  light-signal-amber-soft: "#fff2cc"
  light-signal-green: "#0f7a42"
  light-signal-green-soft: "#e0f4e8"
  light-signal-blue: "#185caa"
  light-signal-blue-soft: "#e4effc"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
  headline:
    fontFamily: "Barlow Semi Condensed, ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
  title:
    fontFamily: "Barlow Semi Condensed, ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "22px"
  body:
    fontFamily: "Barlow Semi Condensed, ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "Barlow Semi Condensed, ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  small:
    fontFamily: "Barlow Semi Condensed, ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  caption:
    fontFamily: "Barlow Semi Condensed, ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.08em"
  led:
    fontFamily: "Doto Variable, Doto, ui-monospace, monospace"
    fontSize: "24px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.02em"
    fontVariation: "'ROND' 20"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1
rounded:
  md: "6px"
  lg: "8px"
  xl: "10px"
  2xl: "14px"
  3xl: "18px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  control: "36px"
  control-sm: "32px"
  control-lg: "44px"
  control-touch: "44px"
  row: "52px"
  nav-row: "40px"
  header: "56px"
  header-desktop: "64px"
  tabbar: "60px"
  sidebar: "240px"
  sidebar-collapsed: "64px"
  content-max: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.crimson}"
    textColor: "{colors.crimson-fg}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "{spacing.control}"
  button-primary-hover:
    backgroundColor: "{colors.crimson-hover}"
  button-secondary:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "{spacing.control}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "{spacing.control}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "{spacing.control}"
  button-danger:
    backgroundColor: "{colors.signal-red}"
    textColor: "{colors.crimson-fg}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "{spacing.control}"
  button-sm:
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "{spacing.control-sm}"
    typography: "{typography.label}"
  button-lg:
    rounded: "{rounded.xl}"
    padding: "0 20px"
    height: "{spacing.control-lg}"
    typography: "{typography.title}"
  card:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  surface-pop:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
  input:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0 14px"
    height: "{spacing.control}"
  input-disabled:
    backgroundColor: "{colors.panel-sunken}"
    textColor: "{colors.ink-muted}"
  badge-neutral:
    backgroundColor: "{colors.panel-sunken}"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.md}"
    padding: "0 6px"
    height: "20px"
  badge-success:
    backgroundColor: "{colors.signal-green-soft}"
    textColor: "{colors.signal-green}"
    rounded: "{rounded.md}"
    padding: "0 6px"
    height: "20px"
  badge-danger:
    backgroundColor: "{colors.signal-red-soft}"
    textColor: "{colors.signal-red}"
    rounded: "{rounded.md}"
    padding: "0 6px"
    height: "20px"
  badge-warn:
    backgroundColor: "{colors.signal-amber-soft}"
    textColor: "{colors.signal-amber}"
    rounded: "{rounded.md}"
    padding: "0 6px"
    height: "20px"
  badge-info:
    backgroundColor: "{colors.signal-blue-soft}"
    textColor: "{colors.signal-blue}"
    rounded: "{rounded.md}"
    padding: "0 6px"
    height: "20px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0 10px"
    height: "{spacing.nav-row}"
  nav-item-active:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
  tabs-track:
    backgroundColor: "{colors.panel-sunken}"
    rounded: "{rounded.xl}"
    padding: "4px"
  tab-active:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  board-row:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.ink}"
    padding: "8px 16px"
    height: "{spacing.row}"
  board-row-hover:
    backgroundColor: "{colors.panel-raised}"
  board-figure-due:
    textColor: "{colors.signal-red}"
    typography: "{typography.led}"
  board-figure-ending:
    textColor: "{colors.signal-amber}"
    typography: "{typography.led}"
  board-figure-lapsed:
    textColor: "{colors.ink-faint}"
    typography: "{typography.led}"
  board-caption:
    typography: "{typography.caption}"
  kbd:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.mono}"
    rounded: "{rounded.md}"
    padding: "0 6px"
    height: "20px"
---

# Design System: GymBook

## Overview

**Creative North Star: "The Platform Indicator Board"**

GymBook is the departures board the gym owner reads every morning at the desk, usually on a phone, one-handed. The ground is near-black; panels are a step lighter charcoal separated by hairlines rather than shadows; the ink is off-white. Nothing on the board is decorative: a row is a name, a reason, and a number that counts down, and the number is set in a dot-matrix face so it reads like a lit display. Colour is reserved for signal. Each signal colour has exactly one meaning (red is money pending, amber is a plan ending inside seven days, green is active or in the gym right now, blue is a plan that starts later), and brand crimson appears only on the primary action and the logo.

Density is a desk register, not a marketing page: 52 px rows, 20 px card padding, a single 8 px grid, right-aligned numerals in one column. Hierarchy comes from size and ink level (ink, muted, faint), never from colour or weight alone; headings sit at 600, labels at 500, body at 400. Controls are the standard web controls, 36 px on a pointer device and 44 px on a touch screen.

The board is the default and the only theme the system follows on its own. The light theme is the same roles translated to a cool light board (white panels, cool grey canvas, darker signal colours) and is reached only by the owner's stored opt-out; the app does not follow the operating system's colour scheme. Rejected: four equal stat cards above a chart, uppercase kickers and eyebrow labels, and decorative gradients or glows.

**Key Characteristics:**
- Near-black board with charcoal panels and 1 px hairlines; tonal steps carry depth, floating layers get one soft shadow.
- One interface face (Barlow Semi Condensed) and one signature numeral face (Doto dot-matrix, weight 900) used only where the board counts down.
- Signal colours are jobs, not moods: red, amber, green, blue each mean one thing everywhere.
- Crimson is brand and primary action only; it never carries status.
- Sentence case throughout; the only uppercase in the system is the 12 px caption under a board numeral.
- 8 px spacing grid, 52 px board rows, 36/44 px controls, 10 px control radius, 14 px card radius.
- Motion is a critically damped spring (no overshoot) or a 150 ms ease-out; reduced motion collapses it all to a 150 ms cross-fade.

## Colors

The palette is a dark board of five neutral steps and three ink levels, one brand crimson, and four signal colours with a soft tint each; all values live as RGB triplets on `:root` so every role can take an alpha.

### Primary
- **Crimson** (`crimson`): the brand red. The primary button, the logo mark, the focus ring (at 70 %), the caret and native `accent-color`, text selection (at 22 %). It is never used to say "overdue" or "error"; that is signal red's job.
- **Crimson hover** (`crimson-hover`): primary button hover, slightly brighter on the dark board and darker on the light one.
- **Crimson soft / Crimson ink** (`crimson-soft`, `crimson-ink`): the tinted pair used for one of the four avatar hues and nothing else.

### Signal
- **Signal red** (`signal-red`): money pending or overdue, the destructive button, invalid field borders, error text. On the board it lights the PENDING numerals and the "4 owe ₹4,900" summary.
- **Signal amber** (`signal-amber`): a plan ending within 7 days ("Expiring soon", "Partly paid", ENDING numerals, backup-overdue banner).
- **Signal green** (`signal-green`): active, paid, in the gym now. The live dot, the cash-received bars in the chart, "Active" and "Paid" badges, completed first-run steps.
- **Signal blue** (`signal-blue`): a membership that starts later, an overpaid invoice, informational toasts and banners.
- Each signal has a `-soft` tint used only as the fill behind its own colour (badges, banners, form errors); soft tints are never used as general surfaces.

### Neutral
- **Board deep** (`board-deep`): the desktop sidebar, one step below the canvas.
- **Board canvas** (`board-canvas`): page background, sticky header (at 85–95 % with blur), bottom tab bar.
- **Panel surface** (`panel-surface`): cards, inputs, secondary buttons, table headers.
- **Panel raised** (`panel-raised`): floating layers (dialogs, drawer, toasts, command palette), the active nav item and tab, and row hover.
- **Panel sunken** (`panel-sunken`): tab tracks, neutral badges, ghost hover, disabled inputs, dialog footers (at 40 %).
- **Ink / Ink muted / Ink faint** (`ink`, `ink-muted`, `ink-faint`): the three text levels. Ink for names, figures and headings; muted for labels, descriptions and secondary nav; faint for placeholders, group captions, lapsed numerals and footer text.
- **Hairline / Hairline strong** (`hairline`, `hairline-strong`): 1 px dividers and card borders; strong for input borders, the active-nav inset ring, the sheet drag handle and scrollbars.
- The light board swaps every neutral and signal for its `light-` counterpart; crimson and its foreground do not change.

### Named Rules
**The One Job Rule.** Red means money pending, amber means ending within 7 days, green means active or present now, blue means starts later. A signal colour never appears for any other reason, and no second colour is ever added to say the same thing.

**The Crimson Is Not a Signal Rule.** Brand crimson belongs to the primary action, the logo and the focus ring. Status, errors and overdue amounts use signal red, which is a different hue.

**The Soft Tint Rule.** A `-soft` colour only ever sits directly behind its own signal colour (badge, banner, error box). It is not a card, section or hover background.

## Typography

**Interface Font:** Barlow Semi Condensed 400/500/600 (with ui-sans-serif, -apple-system, Segoe UI, Roboto)
**Numeral Font:** Doto Variable, weight 900, `'ROND' 20` (with ui-monospace)
**Mono Font:** ui-monospace, SFMono-Regular, Menlo, Consolas (keyboard hints only)

**Character:** A single condensed grotesque does all the reading, tight enough for a phone register, with hierarchy drawn from size and ink level rather than weight swings. Against it, Doto's rounded dot-matrix numerals are the lit display: tabular, one line high, right-aligned in one column.

### Hierarchy
- **Display** (600, 30px → 36px at ≥640px, line-height 1.2): the page title in the desktop page header. Phones skip it on the home screen.
- **Headline** (600, 18px / 24px): card and dialog titles, the "Due next" board heading.
- **Title** (500, 16px / 22px): member names in rows, settings section titles, first-run step titles.
- **Body** (400, 15px / 22px): default text, buttons (600), inputs, nav items (500).
- **Label** (500, 14px / 20px): field labels, tabs, strip labels (muted, 400), table cells.
- **Small** (400, 13px / 18px): badges (500), hints, table headers (500, muted), activity timestamps.
- **Caption** (500, 12px / 16px, 0.08em, uppercase): the one uppercase element. The word under a board numeral: PENDING, ENDING, LAPSED. Also the bottom tab labels and avatar initials at 12px without the tracking or caps.
- **LED** (Doto 900, 24px board rows and totals strip, 28px strip at ≥640px, 22px in member lists, 18–30px stat figures stepping down with length): amounts due, days left, counts on the board and stat figures.

### Named Rules
**The Lit Numeral Rule.** The dot-matrix face is for what the board counts: amounts due, days left, counts on the board and stat figures. Money in prose, invoice totals, deltas and table cells stay in Barlow with tabular figures.

**The Sentence Case Rule.** Every heading, button, label, badge and nav item is sentence case. The only uppercase is the 12 px tracked caption under a board numeral; no kickers, eyebrows or section-label caps anywhere else.

**The Ink Level Rule.** Hierarchy inside a component is ink → muted → faint, with size; weight stays within 400–600 and is never pushed to 700+.

## Layout

An 8 px grid throughout: 4 and 8 px for inline gaps, 12 px between controls, 16 px row padding on phones, 20 px card padding and 24 px between cards, 32 px page padding on desktop. Content is centred to a 1200 px maximum.

Desktop (≥1024px) is a sticky 240 px sidebar (64 px collapsed, stored per browser) on the deep board, a 64 px sticky header with the ⌘K search and the "Add member" primary button, and the page. The home screen is a two-thirds / one-third grid: the board and its totals strip lead, "This month" and activity sit beside them, the money chart follows underneath.

Phones and tablets (<1024px) drop the sidebar and page title: a 56 px header (logo, gym name, search, "Add"), the content with 16 px side padding, two fixed desk actions ("Check in", "Record payment") sitting 72 px above a 60 px five-slot bottom tab bar with safe-area padding, and an 84 px bottom pad on `main` so nothing hides under the bar. Dialogs become bottom sheets (92 dvh max, 18 px top radius, drag-to-dismiss); the full nav is a 288 px left drawer. Tables below 640 px give way to row cards.

Density values: board rows are at least 52 px with a 36 px avatar; table rows are 12 px vertical padding; nav rows are 40 px; the totals strip is a single card split by hairlines into 2 columns on phones and 4 on desktop, never four separate cards.

Pointer-aware controls: 36 / 32 / 44 px (md / sm / lg) on a fine pointer, 44 / 40 / 48 px on a coarse pointer; inputs lock to 16 px text on coarse pointers; tabs are 40 px and options 44 px minimum on touch.

## Elevation & Depth

Depth on the dark board is tonal: deep → canvas → surface → raised, with 1 px hairlines marking every edge. Content cards carry no shadow at all. Only floating layers (dialogs, sheets, drawer, toasts, command palette, the fixed phone actions) get one soft, diffuse shadow with a hairline-bright inset edge. The light board adds a 1 px, 6 % shadow under cards because white-on-grey needs the lift that charcoal-on-black does not.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 0 0 0 rgb(0 0 0 / 0)` dark; `0 1px 2px rgb(16 20 26 / 0.06)` light): content cards, secondary buttons, the header search field.
- **Pop** (`0 12px 32px rgb(0 0 0 / 0.5), 0 1px 0 rgb(255 255 255 / 0.04) inset` dark; `0 12px 32px rgb(16 20 26 / 0.14), 0 1px 2px rgb(16 20 26 / 0.06)` light): every floating layer.
- **Sheet** (`0 -12px 32px rgb(0 0 0 / 0.5)` dark; `0 -12px 32px rgb(16 20 26 / 0.14)` light): layers rising from the bottom edge.
- **Primary button** (`inset 0 1px 0 rgb(255 255 255 / 0.18), 0 1px 2px rgb(0 0 0 / 0.16), 0 6px 14px -8px rgb(0 0 0 / 0.28)`): a top-edge highlight and a short soft drop so the crimson button reads as a key.
- **Inset ring** (`inset 0 0 0 1px rgb(var(--c-line-strong))`): the active nav item and active tab-bar slot; selection is a hairline, not a fill colour.
- **Overlay** (`rgb(0 0 0 / 0.4)`): the scrim behind dialogs and the drawer.

### Named Rules
**The Hairline Depth Rule.** Surfaces at rest are flat and bordered; a shadow means the layer floats above the page and can be dismissed.

## Shapes

Softly rounded rectangles on a fixed scale: 6 px for badges, kbd and small icon buttons; 8 px for small buttons, nav icon tiles and banners' inner controls; 10 px for inputs, buttons, nav items, tab tracks and banners; 14 px for cards, dialogs, toasts and the drawer edge; 18 px for the top of a phone bottom sheet. Avatars, live dots and the sheet drag handle are full circles. Borders are 1 px hairlines everywhere; the stronger hairline marks input edges and selected states. Icons are Lucide at 1.5 px stroke, 16 px inside buttons and 18–20 px in navigation; there are no filled or glyph icons. The chart draws flat, square-ended bars on hairline gridlines with no gradient.

## Components

### Buttons
Pressable keys: firm, compact, one accent.
- **Shape:** softly rounded (10 px; 8 px at the small size), 600 weight, icon 16 px with an 8 px gap, height from the control scale (36 / 32 / 44 px, 44 / 40 / 48 on touch).
- **Primary:** crimson fill, white text, 16 px horizontal padding, the key-cap shadow; hover shifts to crimson hover. One per view: "Record payment", "Add member", "Save".
- **Secondary:** panel surface fill, hairline border, ink text; hover strengthens the border and tints with sunken at 60 %.
- **Outline:** transparent with a strong hairline; **Ghost:** transparent, muted text, sunken hover; **Danger:** signal red fill, white text, brightness 110 % on hover.
- **Press / Focus:** every pressable scales to 0.97 over 120 ms; focus-visible is a 2 px crimson ring at 70 % offset 2 px from the canvas. Disabled is 50 % opacity. Loading swaps the icon for a spinning loader.

### Badges
- **Style:** 20 px tall, 13 px medium text, 6 px radius, soft fill with the signal colour as text and an inset ring of the same colour at 20–25 %. Neutral and muted use the sunken panel with a hairline ring.
- **State:** tone is the whole meaning: Active (green), Expiring soon / Partly paid (amber), Expired / Unpaid (red), Starts later / Overpaid (blue), Cancelled / Void / Sample (muted). Optional 6 px leading dot in the same colour.

### Cards / Containers
- **Corner Style:** 14 px.
- **Background:** panel surface with a 1 px hairline; floating variants use panel raised.
- **Shadow Strategy:** none at rest on the dark board (see Elevation); light board adds the 1 px card shadow.
- **Border:** 1 px hairline; internal rows divide with the same hairline and the last row drops its border.
- **Internal Padding:** 20 px; header is title (18 px / 600) plus optional muted description; list cards run rows edge to edge with 16–20 px side padding.

### Inputs / Fields
- **Style:** 36 px (44 on touch) panel-surface field, strong hairline border, 10 px radius, 14 px side padding, 15 px text (16 px on touch), faint placeholder. Label above at 14 px / 500 with a 6 px gap; hint below at 13 px muted.
- **Focus:** border shifts to ink at 60 % with a 3 px ink ring at 10 %; no colour change, no glow.
- **Error / Disabled:** invalid border and ring turn signal red; the error line is 13 px / 500 red with `role="alert"`. Disabled fills with sunken and muted text. Money inputs lead with a muted ₹ and tabular figures.

### Navigation
- **Sidebar:** deep board, 240 px, groups captioned in 13 px faint sentence case (Front desk / Manage / Insights), 40 px items at 15 px / 500 with 18 px icons; active item is panel raised with the strong-hairline inset ring and ink icon; hover is raised at 70 %.
- **Header:** sticky canvas at 85–95 % with backdrop blur, hairline bottom; the search field is a 36 px surface pill with a ⌘K kbd.
- **Tab bar (phones):** 60 px, five slots, 12 px / 500 labels under 20 px icons; the active slot's icon sits in a 28 × 48 px raised tile with the inset ring.
- **Tabs (in-page):** a sunken 10 px track with 4 px padding; the active tab is a raised 6 px chip with a hairline ring; counts in tabular faint.

### The Board
The signature. An ordered list inside a card: each row is a 36 px avatar, the member name (16 px / 500) over a muted reason line, and on the right a right-aligned LED numeral (Doto 900, 24 px) with its 12 px uppercase caption beneath. Tone is the whole row's right column: red for PENDING amounts, amber for ENDING days, muted for LAPSED. Rows are at least 52 px, divided by hairlines, lift to panel raised on hover and press to 0.97. The heading line carries the totals in the same colours ("4 owe ₹4,900 · 3 ending this week"). Under the board, a single card split by hairlines holds four LED figures (Outstanding in red when non-zero, Received today, Attendance today with the green live dot, Active members).

### Dialogs, sheets, toasts
Floating layers share `surface-pop`: raised panel, hairline, pop shadow, 14 px radius. Desktop dialogs centre at up to 448–896 px and enter with a 0.3 s no-bounce spring from 98 % scale; phone dialogs are bottom sheets with an 18 px top radius, a 36 × 4 px strong-hairline handle and a 0.4 s spring, dismissed by dragging 120 px. Footers sit on sunken at 40 % behind a hairline. Toasts are 14 px pop cards with a 16 px signal icon, stacked top-centre on phones and bottom-right on desktop.

## Do's and Don'ts

### Do:
- **Do** give each signal colour one job only: red for money pending, amber for ending within 7 days, green for active or in the gym now, blue for starts later.
- **Do** keep crimson for the primary action, the logo and the focus ring; use signal red, not crimson, for anything overdue or destructive.
- **Do** set amounts due, days left, board counts and stat figures in the `.led` numeral face (Doto 900, `'ROND' 20`), right-aligned in one column, and keep every other number in Barlow with tabular figures.
- **Do** build depth from the tonal steps (deep → canvas → surface → raised) and 1 px hairlines; reserve the pop shadow for layers that float and dismiss.
- **Do** keep controls at 36 px on a fine pointer and 44 px on a coarse pointer, with 16 px input text on touch; use `.h-control*` rather than hard-coded heights.
- **Do** write everything in sentence case, 400–600 weight, with hierarchy from size and ink level.
- **Do** ship the dark board as the default and keep light as a stored opt-out via `data-theme='light'`; translate roles, never invent light-only colours.
- **Do** use the motion tokens (0.3 s / 0.4 s springs with zero bounce, 150 ms ease-out, `cubic-bezier(0.22, 1, 0.36, 1)`) and let `prefers-reduced-motion` collapse them to a cross-fade.

### Don't:
- **Don't** add uppercase kickers, eyebrows or tracked section labels; the only uppercase is the caption under a board numeral.
- **Don't** use a `-soft` tint as a card, section or hover background, or colour a whole row or card by status; status lives in the numeral, the badge or the summary text.
- **Don't** arrange the home screen as four equal stat cards above a chart; the board leads and today's figures sit in one hairline-divided strip.
- **Don't** put shadows on content cards on the dark board, and never use hard offset or coloured shadows anywhere.
- **Don't** use the dot-matrix face for prose amounts, invoice totals, deltas, table cells or decorative numbers.
- **Don't** follow `prefers-color-scheme`; the board is the default and only the stored preference changes it.
- **Don't** introduce a second icon set, filled icons or a stroke other than 1.5 px; everything is Lucide.
- **Don't** push weight past 600 or use colour alone to carry hierarchy.

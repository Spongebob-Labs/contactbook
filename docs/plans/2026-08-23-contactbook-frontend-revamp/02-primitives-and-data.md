# PART 02 — FIXTURES, PRIMITIVES & SHELL  ·  T04 · T05 · T08 · T09 · T10 · T17

> Track table and shared context: `00-overview.md`. **No step here is a commit step.**

---

## T04 — Fixtures, fixture gateway, formatters, auth context

- **Goal:** the only data source in the entire application, plus the `?state=` switch that
  makes loading / empty / error / offline reachable and therefore testable.
- **Depends on:** T03  ·  **Wave 3**
- **Files:**
  - `apps/web/src/fixtures/user.ts` · `profile.ts` · `cards.ts` · `contacts.ts` ·
    `extremes.ts` · `index.ts` `[all new]`
  - `apps/web/src/lib/fixture-gateway.tsx` `[new]`
  - `apps/web/src/lib/fixture-auth.tsx` `[new]`
  - `apps/web/src/lib/format.ts` `[new]`
  - `apps/web/src/lib/screen-state.ts` `[new]`
  - `apps/web/public/portraits/{priyanka,arjun,mei}.png` `[new — generated, see X-1]`
  - `apps/web/tests/unit/format.test.ts` · `tests/unit/fixture-gateway.test.tsx` ·
    `tests/contract/fixtures.test.ts` `[all new]`

- **Reference material:** spec §6.3 (the gateway contract and the `?state=` table verbatim),
  §10.3 (the fixture inventory, file by file), §10.1 (React state only), §7.1
  (`FixtureAuthProvider` is **not** a security boundary — annotate it as such in the
  source), §6.6 (the display rules the formatters implement), §8A.6 (payload ≤ 60 bytes,
  slug ≤ 24 chars).

- **Fixture inventory (spec §10.3 — build exactly this):**
  | File | Contents |
  |---|---|
  | `user.ts` | one `User`, plus a `userNoAvatar` variant with `avatarUrl: null` (E-19) |
  | `profile.ts` | 7 `FieldGroup`s (one per `FieldCategory`) and **≥ 25 `ProfileField`s covering all 21 `FieldType`s** — every renderer must be exercisable (AC-21) |
  | `cards.ts` | **9 cards**: one per template (8) **plus `card_empty_demo` with `fieldIds: []`** — a permanent fixture, not a test artefact (§11.6) |
  | `contacts.ts` | 12 `Contact`s, including one whose `sourceCardSlug` dangles (E-39) |
  | `extremes.ts` | 40+ char name / job title / company; a 25-field card; a 1-field card; missing avatar; a `backgroundSrc`-style broken image URL; a 60-char unbroken token; a value containing `,` `;` `\`; a value containing `<script>` (E-51) |

- **Steps:**
  1. Write `tests/unit/format.test.ts` covering, from spec §6.6: E.164 phone display,
     `mailto:`/`tel:` href construction, URL display (protocol stripped, clamped to 34
     chars), `SOCIAL_LINK` platform-from-hostname + `@handle`, `AddressDetail` to 1–2 lines,
     `en-GB` long date, and **financial masking — last 4 shown, rest `••••`**.
  2. Run it — fails, module missing.
  3. Write `src/lib/format.ts`. Pure functions only, no React, no DOM.
  4. Run it — green. Paste output.
  5. Write `tests/contract/fixtures.test.ts` asserting **AC-08**: for every fixture card,
     `slug.length <= 24 && /^[a-z0-9-]+$/.test(slug)` and
     `Buffer.byteLength(`${SITE_URL}/c/${slug}`) <= 60`. Also assert `profile.ts` covers all
     21 `FieldType`s and that `card_empty_demo.fieldIds` is `[]`.
  6. Run it — fails, fixtures missing.
  7. Write the five fixture modules, typed against `@/types/domain` and `as const`-frozen.
     Slugs are short and opaque (`prya-hq`, `card_ledger_demo` → slug `prya-hq` per spec
     §6.7). **Card ids are `card_…`-prefixed** so `/cards/new` can never collide (E-38).
  8. Generate the three portrait PNGs per overview §7 X-1 (procedural, `pngjs`, ≥ 320²).
     Log them `PLACEHOLDER-ART` in the run-log.
  9. Write `src/fixtures/index.ts` — a barrel exporting a single frozen `FixtureDb`
     (`{ user, groups, fields, cards, contacts }`). **Do not re-export `marketing.ts`** —
     that file belongs to T26 and importing it here would create a cross-track edit
     (overview §1.2).
  10. Run `tests/contract/fixtures.test.ts` — green.
  11. Write `tests/unit/fixture-gateway.test.tsx`: render a probe component under a mocked
      `useSearchParams` for each of `success | loading | empty | error | offline` and assert
      the returned `FixtureResult` shape from spec §6.3 exactly, plus **`?state=banana`
      falls back to `success` and never throws** (E-34).
  12. Run it — fails.
  13. Write `src/lib/screen-state.ts`: `parseScreenState(raw: string | null): ScreenState`
      with the unrecognised-value fallback, and the `SCREEN_STATES` tuple.
  14. Write `src/lib/fixture-gateway.tsx`: `'use client'`,
      `useFixture<T>(select: (db: FixtureDb) => T): FixtureResult<T>`.
      **Returns synchronously. No timers, no promises, no artificial latency** (§6.3) — a
      fake delay makes every downstream test flaky for zero benefit.
  15. Run the gateway test — green.
  16. Write `src/lib/fixture-auth.tsx`: `FixtureAuthProvider` + `useFixtureAuth()`, seeded
      "signed in as the fixture user", in-memory only. Put a prominent source comment:
      *"NOT a security boundary. Simulated auth for a UI-only run (spec §7.1). Replaced
      wholesale when the real API arrives."*
  17. Run `pnpm --filter web typecheck` and `lint` — exit 0.
  18. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/unit/format.test.ts tests/unit/fixture-gateway.test.tsx tests/contract/fixtures.test.ts
  pnpm --filter web typecheck && pnpm --filter web lint
  grep -rn "localStorage\|sessionStorage\|document.cookie\|fetch(" apps/web/src/fixtures apps/web/src/lib/fixture-gateway.tsx apps/web/src/lib/fixture-auth.tsx
  ```
  Success: 3 test files green · both gates exit 0 · **the grep prints nothing** (AC-06).

- **Done when:** AC-08 green; all 21 `FieldType`s represented in `profile.ts`;
  `card_empty_demo` exists with zero `fieldIds`; the `?state=` table of §6.3 is implemented
  row-for-row; `useFixture` is synchronous.

- **Do not touch:** `src/fixtures/marketing.ts` (T26), `src/lib/tokens.ts` / `cn.ts` /
  `contrast.ts` (T02), `tests/helpers/**` (T01).

- **Traps:**
  - `useSearchParams()` **requires `<Suspense>`** in App Router. `useFixture` calls it, so
    every consumer must be wrapped — overview §0.5 is the pattern. Document that
    requirement in a comment at the top of `fixture-gateway.tsx` so no screen track misses
    it.
  - No `localStorage`, no `sessionStorage`, no cookies (§10.1). Fixture state resets on
    reload **by design** (§5.7). Do not "helpfully" add persistence — it is the first crack
    in the §3.1 wall.
  - The `?state=` switch ships in **production** builds. It is a review tool for Vansh, not
    a dev affordance (§6.3). Do not gate it behind `NODE_ENV`.

---

## T05 — Core primitives

- **Goal:** thirteen components with Radix behaviour and 100% our visual layer — the
  vocabulary every screen composes from and **no screen may edit**.
- **Depends on:** T02  ·  **Wave 3**
- **Files:** `apps/web/src/components/primitives/{button,input,textarea,select,checkbox,
  radio-group,switch,label,chip,badge,avatar,skeleton,rule}.tsx` + `index.ts`;
  `apps/web/tests/unit/primitives.test.tsx` `[all new]`

- **Reference material:** spec §8D.7 (inventory + which Radix primitive backs each + the
  Button anatomy paragraph), §8.3 (the focus rule already exists globally — **do not
  reimplement it per component**), §8.6 (radius allowlist), §8.7 (elevation: primitives are
  `--elevation-0`, always), §8.8 (icon sizes 16/20/24 only; `aria-label` on every icon-only
  control), Q29 (Radix for behaviour, never the shadcn look).

- **Component states to implement and test (each becomes an assertion):**
  default · hover · active/pressed · `:focus-visible` · disabled · invalid/error ·
  read-only (inputs) · checked/unchecked/indeterminate (checkbox) · loading/busy (button).

- **Button anatomy (spec §8D.7):** one component, **five variants** — `primary`,
  `secondary`, `ghost`, `destructive`, `text-link` — and **two sizes**, 40px and 52px.
  Label at `--type-label`, radius `--radius-md`, `--elevation-0`, disabled renders
  `--ink-faint` on `--paper-sunk` with `cursor: not-allowed` **and an `aria-disabled`
  explanation** (never a bare disabled attribute with no reason).

- **Steps:**
  1. Write `tests/unit/primitives.test.tsx` starting with Button: renders each of the five
     variants, applies `type="button"` by default, forwards `ref`, and a disabled button
     exposes `aria-disabled` plus an accessible description.
  2. Run — fails.
  3. Write `src/lib/…` — **no.** `cn` already exists at `@/lib/cn` (T02). Import it.
  4. Write `button.tsx`. Run the test — green.
  5. Repeat the red→green cycle per component, one at a time, appending assertions to the
     same test file: `Input` (label association, `aria-invalid`, `aria-describedby` for the
     error), `TextArea`, `Select` (Radix, keyboard-navigable, `aria-label`),
     `Checkbox`, `RadioGroup`, `Switch`, `Label`, `Chip`, `Badge`, `Avatar` (Radix, with
     **monogram fallback** — E-19/E-20 reuse this), `Skeleton` (`aria-busy`, opacity-pulse
     shimmer that is static under reduced motion), `Rule` (a real `border`, never a
     `box-shadow` fake — box-shadow hairlines do not survive PNG export).
  6. Write `index.ts` re-exporting all thirteen.
  7. Run the full file — green. Paste the summary line.
  8. Run `pnpm --filter web typecheck && pnpm --filter web lint` — exit 0.
  9. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/unit/primitives.test.tsx
  pnpm --filter web typecheck && pnpm --filter web lint
  grep -rEn 'shadow-|box-shadow|rounded-2xl|rounded-3xl|font-(bold|semibold|extrabold|black)' apps/web/src/components/primitives
  ```
  Success: all primitive tests green · gates exit 0 · **the grep prints nothing**
  (F-09/F-10/F-11).

- **Done when:** thirteen components exist, each covered by at least one behavioural
  assertion; zero raw colour literals; zero `box-shadow`; zero weight above 500; every
  icon-only control carries `aria-label`.

- **Do not touch:** `src/styles/**`, `src/lib/tokens.ts` (T02); `src/components/overlay/**`
  (T08); `src/components/data/**` (T10). If a primitive needs a new token, return
  `NEEDS_DECISION` — do not add one.

- **Traps:**
  - **Do not reimplement the focus ring.** It is one global `:focus-visible` rule in
    `globals.css`. A per-component ring is how the AA guarantee on accent fills breaks.
  - **Do not install shadcn or copy shadcn markup** (Q29, F-14). Radix primitives directly,
    our classes.
  - `rounded-2xl` / `rounded-3xl` are forbidden outside the mobile sheet (F-10) — and the
    sheet is T08's, not yours.
  - Radix `Select` renders in a portal; its content is an **overlay**, so its
    `--elevation-1` styling belongs in T08's `overlay/` directory conventions. Keep
    `select.tsx`'s trigger here and give its content the same elevation token by class
    only — **do not** write a `box-shadow` literal in this directory.

---

## T08 — Overlay components

- **Goal:** the seven floating surfaces — and the **only** directory in the codebase
  permitted `box-shadow` / `--elevation-1` / `--elevation-2`.
- **Depends on:** T05  ·  **Wave 4**
- **Files:** `apps/web/src/components/overlay/{dialog,confirm-dialog,popover,dropdown-menu,
  tooltip,toast,sheet}.tsx` + `index.ts`; `apps/web/tests/unit/overlay.test.tsx` `[all new]`

- **Reference material:** spec §8.7 (the elevation policy and *why* the old build got it
  wrong), §8D.7 (which Radix primitive backs each), §13.2 (`data-elevation="0|1|2"` on
  overlay roots — a **contract**, not debug cruft), §6.10 (the error panel shape reused by
  `ConfirmDialog`'s destructive copy), E-50 (Escape closes and returns focus to the
  trigger — assert it, do not assume Radix does it).

- **States:** closed · opening · open · closing · with-scroll-lock · nested (dialog over
  sheet is **not** supported — assert it is not reachable).

- **Steps:**
  1. Write `tests/unit/overlay.test.tsx` for `Dialog`: opens on trigger click, traps focus,
     **`Escape` closes it and focus returns to the trigger** (E-50), and the root carries
     `data-elevation="2"`.
  2. Run — fails.
  3. Implement `dialog.tsx` on `@radix-ui/react-dialog`. Run — green.
  4. Repeat red→green for `ConfirmDialog` (destructive variant; the body must be able to
     state **how many cards use a field** — T25 passes that string in, E-41),
     `Popover`, `DropdownMenu`, `Tooltip`, `Toast` (a **reversible-action** affordance;
     destructive actions get inline confirmation instead — §8D.1), and `Sheet`
     (mobile bottom sheet — **the only place `--radius-2xl` and `rounded-2xl` are allowed**,
     F-10).
  5. Write `index.ts`.
  6. Run the file — green.
  7. Run `pnpm --filter web typecheck && lint` — exit 0.
  8. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/unit/overlay.test.tsx
  grep -rEn 'rounded-2xl|rounded-3xl' apps/web/src/components/overlay | grep -v 'sheet.tsx'
  grep -rn 'backdrop-filter\|backdrop-blur' apps/web/src
  ```
  Success: tests green · first grep prints nothing · **second grep prints nothing**
  (F-05 — `backdrop-filter` is forbidden *everywhere*, not just in cards).

- **Done when:** seven components; every one carries `data-elevation`; Escape-restores-focus
  is asserted, not assumed; `rounded-2xl` appears only in `sheet.tsx`.

- **Do not touch:** `src/components/primitives/**` (T05) — compose, never edit.

- **Traps:**
  - **No `backdrop-filter`, anywhere** (F-05, §6.8). A frosted overlay looks right on screen
    and vanishes in `html-to-image` rasterisation. Use an opaque scrim.
  - Elevation is scoped, not banned: a modal with no shadow is a usability failure. Flat in
    flow, real elevation in overlays (§8.7).
  - Radix `Toast` needs a `Provider` + `Viewport` mounted once. Export a `ToastProvider`
    from `index.ts`; **T09 mounts it in `(app)/layout.tsx`** — do not mount it yourself in
    the root layout (that file is T02's).

---

## T09 — App shell: layout components + `(app)` group layout

- **Goal:** the authenticated chrome — 240px collapsible sidebar on desktop, bottom bar on
  mobile — and the route-group layout that mounts it.
- **Depends on:** T04, T05, T10  ·  **Wave 5**
  *(T10 is a real code dependency — `(app)/error.tsx` renders `ErrorPanel`. This edge exists
  specifically so the two tracks never share a wave and never both implement §6.10.)*
- **Files:** `apps/web/src/components/layout/{app-shell,sidebar,bottom-bar,page-header,
  split-view,skip-link}.tsx` + `index.ts`; `apps/web/src/app/(app)/layout.tsx`;
  `apps/web/src/app/(app)/error.tsx`; `apps/web/tests/unit/app-shell.test.tsx` `[all new]`

- **Reference material:** spec §8D.3 (the shell, verbatim — widths, grounds, active-pill
  treatment, breakpoints, safe-area padding), §8.5 (`--sidebar-width: 240px`,
  `--sidebar-collapsed: 68px`, `--bottombar-height: 64px`, `--content-max: 1200px`),
  §6.10 (the error-boundary shape), §13.1 (the structured `console.error` shape — **no PII**).

- **Responsive states (each becomes a test):**
  | Width | Shell |
  |---|---|
  | ≥ 1024px | sidebar expanded 240px, `--paper-sunk` ground, right edge `--hairline` |
  | ≥ 1024px, collapsed | 68px icon rail, `aria-label` on every item, tooltip on hover |
  | 768–1023px | sidebar **starts collapsed** |
  | ≤ 767px | bottom bar, 64px, fixed, 4 items, icon + `--type-caption`, `padding-bottom: calc(64px + env(safe-area-inset-bottom))` on content |

- **Steps:**
  1. Write `tests/unit/app-shell.test.tsx`: the **skip link is the first focusable element**
     and targets `#main` (AC-26); nav has exactly four items (Dashboard · Cards · Contacts ·
     Profile); the active item carries `aria-current="page"` and the `--accent-wash` pill
     class; collapsing sets `data-collapsed="true"` and every item keeps an `aria-label`.
  2. Run — fails.
  3. Implement `skip-link.tsx`, then `sidebar.tsx`, then `bottom-bar.tsx`, then
     `app-shell.tsx` (which chooses between them by CSS media query, **not** by JS width
     measurement — E-45: crossing the breakpoint must not leave an orphaned rail or double
     navigation).
  4. Run — green.
  5. Implement `page-header.tsx` (`--type-display-3` title, optional `--type-body-sm`
     `--ink-muted` subtitle, right-aligned actions, `--hairline` beneath) and
     `split-view.tsx` (the two-pane primitive T23's builder consumes: sticky left pane,
     scrolling right pane, stacked below 1024px).
  6. Write `src/app/(app)/layout.tsx` using `LayoutProps<"/dashboard">`-style typing —
     **the generated global, never an import**. Mount `FixtureAuthProvider` (T04),
     `ToastProvider` (T08), `SkipLink`, `AppShell`, and `<main id="main">`.
  7. Write `src/app/(app)/error.tsx` — `'use client'`, receives
     `{ error: Error & { digest?: string }, reset }`, and renders the §6.10 panel by
     **importing `ErrorPanel` from `@/components/data`** (T10, already landed in wave 4).
     Do **not** re-implement the panel here — one implementation, one place.
     Log `console.error('[contactbook]', { scope: 'app', route, digest, message })` —
     **no PII, ever** (§13.1).
  8. Run `pnpm --filter web test tests/unit/app-shell.test.tsx` — green.
  9. Run `typecheck` + `lint` — exit 0.
  10. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/unit/app-shell.test.tsx
  pnpm --filter web typecheck && pnpm --filter web lint
  ```
  Success: tests green, both gates exit 0. (Real-layout assertions for the shell live in
  T29's `keyboard.spec.ts` and `a11y.spec.ts` — do not attempt geometry here; happy-dom has
  no layout engine.)

- **Done when:** skip link first-focusable; four nav items; collapsed rail keeps labels;
  bottom bar respects the safe-area inset; `(app)/layout.tsx` mounts the auth + toast
  providers; the error boundary logs the §13.1 shape and renders no stack trace.

- **Do not touch:** `src/app/layout.tsx` (T02), `src/components/data/**` (T10),
  `src/components/overlay/**` (T08), any `(app)` child route (T20–T25).

- **Traps:**
  - Use CSS breakpoints for the sidebar↔bottom-bar swap. A JS `window.innerWidth` branch
    causes hydration mismatch **and** fails E-45.
  - The collapse toggle persists **in component state only** — no `localStorage` (§10.1).
  - The user chip must truncate a 40+ char name with an ellipsis while the sidebar stays
    exactly 240px (E-14).

---

## T10 — Data-state components

- **Goal:** the four state families as reusable components, including the distinction the
  spec bans conflating: **first-run empty ≠ filtered-to-nothing empty**.
- **Depends on:** T05  ·  **Wave 4**
- **Files:** `apps/web/src/components/data/{empty-state,empty-filtered-state,error-panel,
  not-found-panel,loading-skeleton,filter-bar,search-field,data-table,screen-state-root}.tsx`
  + `index.ts`; `apps/web/tests/unit/data-components.test.tsx` `[all new]`

- **Reference material:** spec §8D.1 (the four families, with the non-negotiable rules),
  §6.10 (the exact error-panel anatomy: overline / display-3 title / body detail /
  "Try again" **only when `retryable`** / "Go to dashboard" or "Go home" / muted selectable
  digest), §13.2 (`data-screen-state` values), §6.3 (`FixtureError`).

- **Component contract that makes AC-24 provable:**
  `<ScreenStateRoot state={state}>` renders a wrapper carrying
  `data-screen-state="loading|empty|empty-filtered|error|offline|success"`. **Every data
  screen wraps its content in it.** This is the single attribute T29's `states.spec.ts` and
  `a11y.spec.ts` key off.

- **Steps:**
  1. Write `tests/unit/data-components.test.tsx` asserting: `EmptyState` and
     `EmptyFilteredState` are **different components** rendering different copy and
     different actions (`EmptyState` → a primary create CTA; `EmptyFilteredState` →
     "Clear filters"); `ErrorPanel` renders "Try again" **only** when `retryable` is true;
     `ErrorPanel` never renders a stack trace or an error code as a headline;
     `LoadingSkeleton` sets `aria-busy="true"`; `ScreenStateRoot` emits the right
     `data-screen-state`.
  2. Run — fails.
  3. Implement `screen-state-root.tsx`, then `loading-skeleton.tsx` (**layout-matched
     skeletons, never a spinner** — the skeleton occupies the exact box the real content
     will, so nothing shifts; shimmer is an opacity pulse and is static under reduced
     motion), then `empty-state.tsx`, `empty-filtered-state.tsx`, `error-panel.tsx`,
     `not-found-panel.tsx`.
  4. Run — green.
  5. Implement `filter-bar.tsx`, `search-field.tsx`, `data-table.tsx` (real `<table>`
     semantics at ≥ 768px; **table semantics are dropped in favour of a list below 767px**,
     §8D.3 contacts row).
  6. Write `index.ts`. Run the whole file — green.
  7. Run `typecheck` + `lint` — exit 0.
  8. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/unit/data-components.test.tsx
  pnpm --filter web typecheck && pnpm --filter web lint
  ```
  Success: tests green including the explicit "these are two different components"
  assertion.

- **Done when:** nine components; `ScreenStateRoot` emits all six values; skeletons are
  layout-matched and `aria-busy`; the error panel matches §6.10 line for line.

- **Do not touch:** primitives (T05), overlay (T08), any route file.

- **Traps:**
  - Conflating the two empty states is *the* classic and it is explicitly banned (§8D.1).
    Two components, two copies, two actions.
  - **Partial failure renders what succeeded** plus an inline banner — never a whole-page
    error for a partial failure (§8D.1). `ErrorPanel` must therefore be usable inline, not
    only full-page.
  - No spinners. Anywhere. Layout-matched skeletons only.

---

## T17 — Shared app components

- **Goal:** the seven pieces every `(app)` screen composes, extracted here so six parallel
  screen tracks never fight over the same file.
- **Depends on:** T05, T08, T10, T11, T13  ·  **Wave 6**
- **Files:** `apps/web/src/components/app/{stat-row,card-thumb-tile,contact-row,field-list,
  field-count-meter,card-type-chip,source-card-link}.tsx` + `index.ts`;
  `apps/web/tests/unit/app-components.test.tsx` `[all new]`

- **Reference material:** spec §8D.3 (the per-screen component inventory column),
  §5.3 (a card is a filter over profile fields — the field-count badge is the fix for the
  old build's worst bug), §11 E-13 (40+ char name in a thumb tile clamps to 1 line and the
  grid does not reflow), E-39 (a dangling `sourceCardSlug` renders **no** link),
  §6.6 (masking rules `FieldList` must honour).

- **Component contracts:**
  | Component | Must do |
  |---|---|
  | `CardThumbTile` | live `<CardRenderer mode="thumb">` + name + `CardType` chip + template name + **field-count badge**, with a visible `--warning-wash` warning badge when the count is **zero** |
  | `FieldCountMeter` | renders `data-field-count={n}`; at `n === 0` renders the warning treatment (AC-36) |
  | `FieldList` | groups by `FieldCategory` in declaration order; masks `BANK_ACCOUNT`/`DIGITAL_WALLET`/`CRYPTO_WALLET`/`isSensitive`; `LOCATION_TRACKING` renders a status chip, **never a coordinate** |
  | `SourceCardLink` | renders nothing at all when the slug dangles — never a link to a 404 |
  | `StatRow` | 3 hairline-ruled stat blocks, `--type-numeric` with `tabular-nums` |
  | `ContactRow` | name · source card · saved date; collapses to a stacked list ≤ 767px |
  | `CardTypeChip` | one chip per `CardType`, `--radius-full`, `--accent-wash` ground |

- **Steps:**
  1. Write `tests/unit/app-components.test.tsx`: `FieldCountMeter` at `n = 0` renders the
     warning and `data-field-count="0"`; `CardThumbTile` with a 40+ char name clamps to one
     line; `SourceCardLink` with a dangling slug renders `null`; `FieldList` masks a
     `BANK_ACCOUNT` value to `••••1234` and renders no coordinate for
     `LOCATION_TRACKING`.
  2. Run — fails.
  3. Implement each component, one red→green cycle at a time, in the order above.
  4. Write `index.ts`. Run the file — green.
  5. Run `typecheck` + `lint` — exit 0.
  6. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/unit/app-components.test.tsx
  pnpm --filter web typecheck && pnpm --filter web lint
  ```

- **Done when:** all seven exist; the zero-field warning badge is asserted; masking is
  asserted; the dangling-link case is asserted.

- **Do not touch:** `src/card/**` (T06/T07/T11/T12/T13/T15) — consume `<CardRenderer>` and
  `resolveCard`, never edit them. No route files. No `share-sheet.tsx` (that is T22's).

- **Traps:**
  - `CardThumbTile` renders `mode="thumb"`, which is **exempt from QR scannability**
    (§8A.5). Its QR is a decorative glyph, `aria-hidden`, encoding nothing. Do not "fix" it
    into a real QR — AC-09(h) asserts it must **not** decode.
  - `FieldList` is used on public surfaces too (T18). There is **no reveal control** for
    masked values outside `/profile` (§7.3, AC-33). Do not add one.

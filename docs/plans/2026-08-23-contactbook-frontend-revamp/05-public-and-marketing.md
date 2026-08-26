# PART 05 — PUBLIC CARD, GALLERY & MARKETING  ·  T14 · T18 · T19 · T26

> Track table: `00-overview.md`. **No step here is a commit step.**
>
> **Cutting order (spec §3.5), for orientation:** if Stage C must cut, it cuts **T26
> (marketing) first**, then **T19 (the gallery)**, then PNG export. **T18 (the public card
> page) is never cut** — it is the screen the whole product exists for.

---

## T14 — Public shells: root error/not-found + `(marketing)` chrome

- **Goal:** the boundaries and chrome the public surfaces mount inside, built once so the
  gallery survives the marketing page being cut.
- **Depends on:** T05, T10  ·  **Wave 5**
- **Files:** `apps/web/src/app/not-found.tsx`, `apps/web/src/app/error.tsx`,
  `apps/web/src/app/(marketing)/layout.tsx`, `apps/web/src/app/(marketing)/error.tsx`,
  `apps/web/src/components/marketing/pill-nav.tsx`,
  `apps/web/src/components/marketing/site-footer.tsx`,
  `apps/web/tests/unit/marketing-chrome.test.tsx` `[all new]`

- **Reference material:** spec §6.10 (the error-surface shape, identical across every
  boundary), §13.1 (four error-boundary levels + the structured `console.error` shape,
  **no PII**), §8D.6 opening paragraph (the nav: a **floating rounded pill bar** —
  Linktree's device — `--surface`, `--elevation-1` because it is fixed and therefore
  qualifies, on the `--paper` ground; left wordmark; centre Templates · How it works ·
  Pricing; right a ghost "Log in" pill and a filled `--accent` "Get started" pill),
  §8D.6 M-9 (the multi-column footer on `--paper-sunk`), R-19 (`/not-found`).

- **Why this is its own track:** the gallery (T19) and the marketing page (T26) both need
  `(marketing)/layout.tsx`, the nav and the footer. If either owned them, cutting the
  marketing page per §3.5 would also kill the gallery. Splitting the chrome out makes the
  cut order actually executable.

- **Steps:**
  1. Write `tests/unit/marketing-chrome.test.tsx`: `PillNav` renders one wordmark, three
     centre links and two right-hand CTAs; **every `target="_blank"` carries
     `rel="noopener noreferrer"`** (AC-32); `SiteFooter` renders multi-column with no icons;
     the root `not-found.tsx` renders the §6.10 panel with a "Go home" link and **no stack
     trace**.
  2. Run — fails.
  3. Write `pill-nav.tsx`. It is `position: fixed`, so `--elevation-1` is permitted here —
     but the styling must come from the token, **never** a `box-shadow` literal (F-09 /
     AC-15). Add `data-elevation="1"`.
  4. Write `site-footer.tsx`. **No icons above the footer** on marketing (§8.8) — the footer
     itself is the one place a social glyph may appear.
  5. Write `src/app/not-found.tsx` and `src/app/error.tsx` (root boundary,
     `scope: 'marketing'`/`'public-card'` as appropriate, structured `console.error`, digest
     surfaced as a muted selectable caption when present).
  6. Write `(marketing)/layout.tsx` (mounts `PillNav` + `<main>` + `SiteFooter`) and
     `(marketing)/error.tsx`.
  7. Run the unit test — green.
  8. Run `typecheck` + `lint` + `build` — exit 0. **`/` will still 404 until T26 lands;
     that is expected.**
  9. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/unit/marketing-chrome.test.tsx
  pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build
  grep -rn 'box-shadow' apps/web/src/components/marketing
  ```
  Success: unit green · gates exit 0 · **the grep prints nothing** (use the elevation token).

- **Done when:** four boundary/chrome files plus two components exist; no stack traces, no
  raw error codes as headlines; `rel="noopener noreferrer"` on every external link.

- **Do not touch:** `src/app/(marketing)/page.tsx` and the nine section components (T26);
  `src/app/(marketing)/templates/**` (T19); `src/app/layout.tsx` (T02).

- **Traps:** the pill nav is the one `--elevation-1` element outside
  `src/components/overlay/**`. It qualifies **because it is fixed** (§8.7). Do not take this
  as licence to shadow anything else in `src/components/marketing/`.

---

## T18 — The public card page `/c/[slug]`

> **The screen the whole product exists for.** Mobile-first: it is reached from a phone
> camera (Q16). **Never cut** (§3.5).

- **Depends on:** T05, T10, T11, T13  ·  **Wave 6**
- **Files:** `apps/web/src/app/c/[slug]/{page,loading,error,not-found,opengraph-image}.tsx`;
  `apps/web/src/components/public-card/{public-card-view,save-to-contacts-button,
  whatsapp-button}.tsx`; `apps/web/tests/e2e/public-card.spec.ts` `[all new]`

- **Reference material:** spec §8D.5 (the whole section), §4.2 (the primary happy path,
  step by step), §6.9 (the two action contracts and their failure modes), §7.3 (PII rules —
  these are **real** even in a UI-only run), §11 E-02, E-37, E-56, AC-20, AC-33, AC-36.

- **Layout:** **no app chrome** — no sidebar, no bottom bar, no marketing nav. `--paper`
  ground. ≤767px: the card fills the viewport width minus `--space-3` each side (min
  `336px`), vertically centred when it fits and top-aligned + scrollable when it does not.
  ≥768px: centred at its `400px` design width with a single `--type-caption` `--ink-muted`
  line beneath — "Made with Contact Book" linking to `/`.

- **The two actions, and exactly two (§8A.2, AC-20):**
  | Action | Contract | Failure |
  |---|---|---|
  | **Save to contacts** (primary) | `buildVcf(r)` → `Blob([…], {type:'text/vcard;charset=utf-8'})` → object URL → anchor `download="{fullName}.vcf"` → **revoke after 30s** | `fields.length === 0` ⇒ **the button is not rendered at all** (E-02) |
  | **Message on WhatsApp** (secondary) | `https://wa.me/{e164 without +}`, `target="_blank" rel="noopener noreferrer"` | no `PHONE` mapped ⇒ **not rendered** — never rendered-and-disabled (E-56); the row collapses to one full-width button with no gap |

- **States (§8D.5):** loading = a card-shaped skeleton at the **exact** aspect · empty = a
  zero-field card renders name + QR, **no Save button**, and a `--type-caption` line reading
  *"This card doesn't share any details yet."* · error/offline = the §6.10 panel with "Go
  home" · **not-found** = a dedicated panel, *"This card doesn't exist or was removed"*,
  **never a raw 404** (E-37).

- **Steps:**
  1. Write `tests/e2e/public-card.spec.ts`:
     - `/c/prya-hq` renders exactly one `[data-card-root][data-render-mode="full"]` and
       exactly one `[data-qr-zone]` (AC-11)
     - **exactly two** action buttons on a card with a `PHONE` (AC-20)
     - a card with **no `PHONE`** renders **one** button and the WhatsApp button is
       **absent from the DOM**, not disabled (E-56)
     - `card_empty_demo`'s slug renders **no "Save to contacts" button at all** plus the
       caption line (E-02, AC-36)
     - no sidebar, no bottom bar, no pill nav anywhere on the page
     - a `BANK_ACCOUNT` renders `••••` + last 4 with **no reveal control present in the
       DOM**, and `LOCATION_TRACKING` renders no coordinate (AC-33)
     - an unknown slug renders the not-found panel text, not a raw 404 (E-37)
     - the five `?state=` values each set `data-screen-state`
  2. Run — fails.
  3. Write `save-to-contacts-button.tsx` and `whatsapp-button.tsx` per the table above.
     Both take the **`ResolvedCard` reference** resolved once by the view — do **not**
     re-derive (I-5).
  4. Write `public-card-view.tsx` (`'use client'`, `useFixture`, `ScreenStateRoot`,
     `<CardRenderer mode="full">`).
  5. Write `page.tsx`: `async`, `const { slug } = await params`, `<Suspense>` wrapper, and
     `generateMetadata` producing per-card `title` + `description`. Write
     `opengraph-image.tsx` rendering the card at **1200×630**.
  6. Write `loading.tsx`, `error.tsx` (scope `'public-card'`), `not-found.tsx`.
  7. Run the spec — green on all three projects.
  8. Run `typecheck` + `lint` + `build` — exit 0.
  9. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web exec playwright test tests/e2e/public-card.spec.ts
  pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build
  ```
  Success: green × 3 projects; three gates exit 0. (The **decode** assertion is T27's
  QR-T5 — do not duplicate it here.)

- **Done when:** AC-20, AC-33 and the E-02 half of AC-36 are green; the page renders the
  card's **own** `templateId`; there is no app chrome; not-found is a panel, never a raw 404.

- **Do not touch:** `src/card/**` (T06/T07/T11/T13), `src/components/marketing/**` (T14/T26),
  `(app)/**`.

- **Traps:**
  - **A zero-field card must not offer Save.** Not disabled — **absent**. `buildVcf` throws
    `EmptyCardError`, so if the button exists it is a crash waiting to happen, and if you
    "fix" that by softening `buildVcf` you have recreated the 73-byte vCard bug (§11.6).
  - **No reveal control, ever, on this page** (§7.3, AC-33). Reveal lives only in `/profile`.
  - `params` is a **Promise**. `generateMetadata` receives the same Promise-shaped props.
  - Revoke the object URL after 30s — a leaked blob URL keeps the whole card in memory.

---

## T19 — Template gallery `/templates`

- **Depends on:** T05, T07, T13, T14  ·  **Wave 6**
- **Files:** `apps/web/src/app/(marketing)/templates/{page,loading,error}.tsx`;
  `apps/web/src/components/gallery/{category-rail,template-grid,template-cell,
  gallery-closing-band}.tsx`; `apps/web/tests/e2e/gallery.spec.ts` `[all new]`

- **Reference material:** spec §8B.5 (measured from the supplied Linktree references —
  follow it exactly), §8A.5 (the `thumb` exemption), AC-30, AC-09(h), AS-16 (`/templates`
  is **public**, under `(marketing)`).

- **Layout (§8B.5):**
  - **Left vertical category rail**, label above in `--type-overline`:
    `BROWSE BY CATEGORY`. Items are full-width pills; the **active one is a filled `--ink`
    pill with `--paper` text**, the rest ghost with `--ink-muted`. Categories:
    `All templates · Business · Personal · Event · Creative`.
  - **Right: a 3-up grid** (2-up at 768–1023px, 1-up below 768px) with **`--space-10`
    (40px) gutters** on a `--paper` ground.
  - **Each cell is a tall rounded frame at ~1:2.15, `--radius-xl` (20px)**, containing a
    **live `<CardRenderer mode="thumb">`** — a real rendered mini card, not a swatch. This is
    the single most important thing the reference gallery gets right.
  - **The template NAME is a left-aligned sans caption BELOW the frame** (`--type-title-2`)
    with the `blurb` beneath it (`--type-body-sm` `--ink-muted`). **The name is never inside
    the frame.**
  - Frames are `--elevation-0`. Separation comes from the gutter and the ground.
  - Closing band: a `--type-display-1` line plus one CTA.

- **States:** all four families (R-02) — loading = a grid of frame-shaped skeletons at the
  real aspect · empty (filtered) = "No templates in that category" + **Clear filters** ·
  error = panel + retry.

- **Steps:** ① write `tests/e2e/gallery.spec.ts`: the rail renders five pills and the
  active one is the filled `--ink` variant; the grid is **3-up at 1440, 2-up at 768, 1-up at
  360** (assert computed column count, not a class name); every cell contains a
  `[data-card-root][data-render-mode="thumb"]`; the name caption is a **sibling below** the
  frame, not a descendant of it (AC-30); **no cell contains a `[data-qr-symbol]`**
  (AC-09(h)); filtering to a category with no members renders the **filtered** empty state,
  not the first-run one → ② run, fails → ③ `template-cell.tsx`, `template-grid.tsx`,
  `category-rail.tsx`, `gallery-closing-band.tsx` → ④ `page.tsx` (`<Suspense>` wrapper) +
  `loading.tsx` + `error.tsx` → ⑤ run, green → ⑥ gates → ⑦ append to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web exec playwright test tests/e2e/gallery.spec.ts
  pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build
  ```

- **Done when:** AC-30 green; the previews are live components; the caption is below the
  frame; no frame carries a shadow.

- **Do not touch:** `(marketing)/layout.tsx`, `pill-nav.tsx`, `site-footer.tsx` (T14);
  `(marketing)/page.tsx` and the section components (T26); `src/card/templates/**` (T07).

- **Traps:**
  - **A `thumb` QR that does not scan is correct** (§8A.5). A tester or executor failing the
    gallery for an unscannable QR has misread the spec and will waste a fix round. AC-09(h)
    asserts the **opposite** of scannability here.
  - The name goes **below** the frame. Putting it inside is the single most common way this
    gallery gets built wrong.

---

## T26 — The marketing one-pager `/` (CUT-FIRST SURFACE)

> Vansh, Q7 verbatim: *"See Marketing website will be just a normal one page scrollable
> website with different section not a very big headache but from the Ui perspective it
> should be the best modern but it should not look AI made."*
>
> **§8C is a requirement with a pass/fail, not a vibe.** Read it in full before starting.

- **Depends on:** T13, T14, **T25** *(T25 is a scheduling edge only — spec §3.5 makes this
  the cut-first surface, so it is built last)*  ·  **Wave 8**
- **Files:** `apps/web/src/app/(marketing)/page.tsx`; `apps/web/src/fixtures/marketing.ts`;
  `apps/web/src/styles/marketing-motion.css`;
  `apps/web/src/components/marketing/{section,hero,step-list,template-strip,scan-demo,
  quote-block,field-catalogue,faq-accordion,pricing-columns,final-cta}.tsx`;
  `apps/web/tests/e2e/marketing.spec.ts` `[all new]`

- **Reference material:** spec **§8D.6 (the nine-section table — build every row)**,
  **§8C.1 (F-01…F-17, the forbidden list)**, §8C.2 (required instead), §8C.3 (the three
  manual review items), §8.9 (motion: exactly **two** scroll-driven moments, no
  scroll-jacking), AC-31.

- **The nine sections (§8D.6):**
  | # | Section | Content | Layout | Motion |
  |---|---|---|---|---|
  | M-1 | Hero | `--type-display-hero`, **left-aligned**, short measure; one-line subhead; **a text-link CTA, not a filled button**; to the right a live `<CardRenderer mode="full">` at a slight angle | asymmetric 2-col ≥1024px, stacked below | **static — the hero never animates in** |
  | M-2 | How it works | three steps, `01 / 02 / 03` in `--type-overline`, **no icons** | 3-col ≥1024px, hairline-separated | none |
  | M-3 | Template showcase | live `thumb` renders of all 8 templates | horizontal scroll-driven strip | **scroll-driven moment 1** |
  | M-4 | QR / scan demo | a real card with a **real** QR; copy explaining a scan; an animated scan sweep across the plate | 2-col ≥1024px | **scroll-driven moment 2 — the only two on the page** |
  | M-5 | Social proof | 3 testimonials at `--type-display-quote`, **no borders, no shadows, no avatars** | 3-col ≥1024px | none |
  | M-6 | Fields | the 21 `FieldType`s as a plain typographic list, grouped by category | 2-col text block | none |
  | M-7 | FAQ | 6 questions, Radix `Accordion`, hairline-separated, **no card frames** | single column at `--prose-max` | height transition at `--dur-base` |
  | M-8 | Pricing | 2 plans, hairline-ruled columns, **not** shadowed cards; CTAs → `/signin/phone` | 2-col ≥768px | none |
  | M-9 | Final CTA + footer | `--type-display-1` closing line + one CTA; the footer comes from T14 | — | none |

  Section rhythm: `--space-20 / --space-24 / --space-32` padding-y at mobile / tablet /
  desktop. `/` is the only route with **no `loading.tsx`** — it is fully static with no
  fixture read.

- **Steps:**
  1. Write `src/fixtures/marketing.ts` first — all copy for the nine sections, typed and
     frozen. **Specific, plain copy: numbers and nouns, not adjectives.**
     *"One card. One QR. Every field you choose."* — **not** *"Effortlessly supercharge your
     networking."* The banned-phrase list (F-13) is:
     `Effortlessly · Seamlessly · Supercharge · Unlock the · Elevate your · game-changing ·
     Say goodbye to · revolutionize · in seconds · Transform your`.
  2. Write `tests/e2e/marketing.spec.ts` asserting **AC-31**:
     - all nine sections render, in order, each with a stable `data-section` id
     - `[data-reveal]` count **≤ 6** and **never on two consecutive sections** (F-12)
     - **at most 3** of the nine sections are centred single-column (F-17)
     - the hero CTA is an **anchor styled as a text link, not a `<button>` with a fill**
     - `src/fixtures/marketing.ts` contains **none** of the F-13 phrases
       (read the file from disk and grep it inside the test)
     - **no `<svg>` icon appears above the footer** (§8.8)
     - the template strip contains 8 live `[data-render-mode="thumb"]` cards
     - the scan demo contains a real `[data-qr-symbol]`
  3. Run — fails.
  4. Write `section.tsx` (the rhythm wrapper), then the nine section components one at a
     time, running the spec after each.
  5. Write `marketing-motion.css`: the two scroll-driven moments using CSS
     `animation-timeline: view()` with an `IntersectionObserver` fallback. **No
     scroll-jacking** — the page never intercepts wheel or touch scroll. Import it from
     `page.tsx`.
  6. Write `(marketing)/page.tsx` composing the nine sections. **No `loading.tsx`.**
  7. Run the spec — green on all three projects.
  8. Run `typecheck` + `lint` + `build` — exit 0. `/` now resolves.
  9. Append the outcome to the run-log, including a note on the three §8C.3 manual review
     items (M-1 asymmetry, M-2 no icon-chip grid, M-3 real imagery) so the final report can
     hand them to Vansh.

- **Verification:**
  ```bash
  pnpm --filter web exec playwright test tests/e2e/marketing.spec.ts
  pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build
  grep -inE 'effortlessly|seamlessly|supercharge|unlock the|elevate your|game-changing|say goodbye to|revolutionize|in seconds|transform your' apps/web/src/fixtures/marketing.ts
  grep -rEn 'gradient|backdrop|rounded-2xl|rounded-3xl|shadow-' apps/web/src/components/marketing
  ```
  Success: spec green × 3 · gates exit 0 · **both greps print nothing**
  (F-13, F-04/F-05/F-09/F-10).

- **Done when:** AC-31 green; nine sections in order; ≤ 6 reveals, never consecutive; ≤ 3
  centred sections; zero banned phrases; zero icons above the footer.

- **Do not touch:** `pill-nav.tsx`, `site-footer.tsx`, `(marketing)/layout.tsx`,
  `(marketing)/error.tsx` (all T14); `(marketing)/templates/**` (T19);
  `src/fixtures/*` other than `marketing.ts` (T04); `src/card/**`.

- **Traps:**
  - **F-06: no 3-up feature-card grid where each cell is an icon in a rounded-square tinted
    chip.** That single layout is the loudest generated-UI tell there is, and M-2 is a
    manual review item that fails the page regardless of what lint says. Use numbered steps
    `01 / 02 / 03` in `--type-overline` instead — Hinge's device, and the direct antidote.
  - **F-04: no gradient blobs, no mesh backgrounds, no `radial-gradient` blur decorations.**
    Marquee's mesh is a declared, contrast-tested template axis inside
    `src/card/templates/**`; a decorative blob behind a marketing hero is not the same thing
    and is forbidden.
  - **Restraint in colour is measured**: AC-16 samples a full-page screenshot of `/` and
    requires paper+ink pixels ≥ 78%. "Primary green everywhere" is the fastest way to make a
    warm palette look cheap — and here it is a failing test.
  - **Real product renders, not images of products.** The template showcase and the scan demo
    render **live `<CardRenderer>` components** (§8C.2). Do not screenshot them into `<img>`.
  - Body copy is never centred below 3 lines except in `(auth)` and the marketing hero;
    measure is capped at 68 characters (§8.4).

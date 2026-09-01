# PART 03 — THE CARD SYSTEM  ·  T06 · T07 · T11 · T12 · T13 · T15

> **This is the product.** Spec §3.5: *"NEVER CUT: the card system, the QR contract, the
> card builder, the public card page."* If anything in this run has to be sacrificed, it is
> never anything in this file.
>
> Track table: `00-overview.md`. **No step here is a commit step.**

### Why the renderer and the eight templates are separate tracks
The 8 template definitions are **pure data** conforming to `CardTemplate`
(`src/card/template-types.ts`, fixed by T03). The renderer consumes that interface and
never reads a template file directly — it reads `TEMPLATES[id]`. Because the contract sits
in a third file that neither track owns, **T07 (data) and T13 (renderer) parallelise
cleanly** across waves 3 and 5 with zero shared files.

The eight templates are **not** split among themselves, deliberately. They share
`templates/index.ts` and `templates/palette.ts`, and §8B.3 assigns each a distinct
combination across seven axes — that is one coherent design judgment, not eight independent
ones (spec R-7: the failure mode is "eight palette swaps"). Splitting them would also split
the §8B.6 contrast fix loop across two owners. One owner, one track.

---

## T06 — QR geometry + `<QrZone>`

- **Goal:** the single component that makes §8A unbreakable — it computes the geometry, the
  template never does.
- **Depends on:** T02, T03  ·  **Wave 3**
- **Files:** `apps/web/src/card/qr-geometry.ts` `[new]`,
  `apps/web/src/card/qr-zone.tsx` `[new]`,
  `apps/web/tests/unit/qr-geometry.test.ts` `[new]`

- **Reference material — read §8A end to end before writing a line.** Specifically §8A.3
  (the geometry table), §8A.4 (who computes what, and the layering rule), §8A.5 (the
  `thumb` exemption), §8A.6 (payload + encoder options), §9.4 (what happens when `qrcode`
  throws).

- **The numbers, transcribed (do not re-derive, do not round):**
  ```
  qrSizePx     = max(140, min(0.42 * cardWidth, 200))     // hard floor 140, hard ceiling 200
  quietZonePx  = max(16, ceil(4 * qrSizePx / moduleCount)) // all four sides
  reserved     = qrSizePx + 2 * quietZonePx                // square
  plate        = solid, fully opaque --surface-raised (#FFFFFF)
  plateRadius  = --radius-xs = 4px MAXIMUM
  module       = --qr-module #0B0B0B on --qr-plate #FFFFFF  -> 19.68:1 (floor 15:1)
  ECC          = 'H'    margin = 0    mode = byte    render = inline SVG
  centre mark  = at most ONE, area <= 20% of symbol (side <= 0.447 * qrSize), >= 2 modules clearance
  ```

- **Steps:**
  1. Write `tests/unit/qr-geometry.test.ts` as a pure table test:
     `qrSize(336) === 141.12 -> floor to >= 140`; `qrSize(400) === 168`;
     `qrSize(600) === 200` (ceiling); `qrSize(200) === 140` (floor);
     `quietZone(140, 41) === 16` (the `max(16, …)` branch);
     `reservedBox(400) === 168 + 32`; `markMaxSide(168) === 75.09…` (`0.447 × 168`).
  2. Run — fails, module missing.
  3. Write `src/card/qr-geometry.ts`: `qrSizePx`, `quietZonePx`, `reservedBox`,
     `markMaxSide`, `MODULE_COLOUR`, `PLATE_COLOUR`, `MIN_MODULE_CONTRAST = 15`. Pure, no
     React, no DOM.
  4. Run — green. Paste output.
  5. Write `src/card/qr-zone.tsx`:
     - Props: `{ payload: string; anchor: QrAnchor; caption: string | null;
       decorate: QrZoneSpec['decorate']; cardWidth: number; mode: RenderMode }`.
     - Encodes with `qrcode` → **inline SVG** (`errorCorrectionLevel: 'H'`, `margin: 0`,
       `type: 'svg'`). SVG, not canvas: crisp at any DPR **and** it rasterises reliably in
       `html-to-image`.
     - Emits `data-qr-zone` on the root, `data-qr-plate` on the plate,
       `data-qr-symbol` on the symbol, `data-qr-mark` on the optional centre mark,
       `data-qr-mode={mode}`.
     - Root carries `isolation: isolate` and is rendered as the **last child of the card
       root** (T13 places it) so no sibling can paint above it.
     - Caption renders **below the plate, outside the reserved region**.
     - `mode === 'thumb'` → a decorative glyph, `aria-hidden="true"`,
       `data-qr-mode="thumb"`, **encoding nothing** (§8A.5).
     - If `qrcode` throws → an opaque plate reading "QR unavailable" in `--danger`;
       **the card's action buttons still work; the card is never blank** (E-30, §9.4).
  6. Add a rendering assertion to the same test file (happy-dom is fine for *DOM shape*,
     never for geometry): exactly one `[data-qr-zone]`; `full` mode contains a
     `[data-qr-symbol]` with a real `<svg>`; `thumb` mode contains **no** `[data-qr-symbol]`
     and is `aria-hidden`.
  7. Run — green.
  8. Run `typecheck` + `lint` — exit 0.
  9. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/unit/qr-geometry.test.ts
  pnpm --filter web typecheck && pnpm --filter web lint
  grep -rn 'backdrop\|opacity\|gradient' apps/web/src/card/qr-zone.tsx
  ```
  Success: tests green · gates exit 0 · **the third grep prints nothing on the plate
  element** (the plate is a flat opaque fill; alpha < 1 fails QR-T2).

- **Done when:** the geometry functions match the §8A.3 table exactly; one `[data-qr-zone]`
  per render; `thumb` encodes nothing; the encoder-failure path renders a plate, not a blank.

- **Do not touch:** `src/card/templates/**` (T07), `src/card/card-*.tsx` (T13),
  `src/styles/**` (T02).

- **Traps:**
  - **The plate is opaque, solid, `#FFFFFF`, radius ≤ 4px.** No gradient, no alpha < 1, no
    background image, **no `backdrop-filter`** — the last one would look correct on screen
    and **vanish in the PNG export** (§6.8, E-27). This is why the plate is not frosted.
  - **Never invert.** Light modules on a dark plate are forbidden; many scanners reject
    inverted symbols.
  - The symbol is an **absolute pixel size**. The card must never `transform: scale()` its
    content in `full` mode — use container queries. Scaling puts the symbol under the 140px
    floor and kills the card (E-25).
  - `margin: 0` on the encoder is deliberate: `<QrZone>` draws the quiet zone in the plate
    colour so the plate owns it.

---

## T07 — Template registry: 8 templates + art assets

- **Goal:** eight templates that read as **eight products, not eight palette swaps**, each
  a typed `CardTemplate` in one exhaustive registry.
- **Depends on:** T02, T03  ·  **Wave 3**
- **Files:** `apps/web/src/card/templates/index.ts`, `palette.ts`, and one file per template:
  `ledger.ts`, `chapter.ts`, `foundry.ts`, `marquee.ts`, `atrium.ts`, `almanac.ts`,
  `terminal.ts`, `passage.ts`; `apps/web/public/templates/{foundry-workshop,atrium-portrait,
  passage-travel}.png`; `apps/web/tests/contract/templates.test.ts` `[all new]`

- **Reference material:** spec §8B.2 (the schema), **§8B.3 (the eight-row art-direction
  table — this is prescriptive; follow it exactly)**, §8B.4 (carried / rejected / adapted),
  §8B.6 (the audit that can fail a beautiful template), §8A.4 (`QrZoneSpec` — `qrZone` is
  non-optional and has no default), §9.4 (`backgroundSrc` 404 fallback).

- **The eight, from §8B.3 — copy these values, do not invent:**
  | # | id | category | background | buttonFill / radius / icon / shadow | textOnMedia | avatarKind | typeFamily | qrZone.anchor |
  |---|---|---|---|---|---|---|---|---|
  | 1 | `ledger` | business | `solid` `--paper` | `tonal` / `rounded-rect` / `none` / `none` | dark | photo | friendly-grotesk | `above-actions` |
  | 2 | `chapter` | business | `solid` `--surface` | `tonal` / `pill` / `none` / `none` | dark | photo | editorial-serif | `below-identity` |
  | 3 | `foundry` | business | `solid+photo-split` deep-green `#123A31` upper 62% | `white` / `rounded-rect` / `none` / `soft` | light | logo-mark | friendly-grotesk | `card-center` |
  | 4 | `marquee` | event | `gradient-mesh` green→clay→amber, **muted** | `solid-accent` / `pill` / `none` / `none` | light | photo | wide-display | `card-center` |
  | 5 | `atrium` | creative | `photo` full-bleed, **hard-cut** to `--surface` at 55% | `white` / `pill` / `leading-platform-chip` / `soft` | light | photo | friendly-grotesk | `above-actions` |
  | 6 | `almanac` | personal | `solid` `--paper-sunk` + `--clay` corner block + `--amber` hairline | `tonal` / `pill` / `leading-emoji` / `none` | dark | photo | editorial-serif | `below-identity` |
  | 7 | `terminal` | business | `solid` `--surface-raised`, strict 8px baseline, left-aligned, overline labels | `tonal` / `rounded-rect` / `none` / `none` | dark | logo-mark | condensed-bold | `bottom-plate` |
  | 8 | `passage` | personal | `photo` muted travel behind `--hairline-inset` 12px frame | `translucent-textured` / `pill` / `none` / `none` | light | photo | editorial-serif | `card-center` |

  `backgroundSrc` is **required** for `foundry`, `atrium`, `passage`; **`null`** for the
  other five (AC-19). `marquee`'s mesh is CSS inside `src/card/templates/**` — the one place
  F-04 permits a gradient.

- **Steps:**
  1. Write `tests/contract/templates.test.ts` asserting, before any template exists:
     - `TEMPLATES` has all 8 `TemplateId` keys and `Object.keys(TEMPLATES).length >= 6` (AC-18)
     - every `name` contains **no digit** — product names, never numbers (AC-18)
     - every template has a non-null `qrZone` with a valid `anchor` and `plate: 'solid'`
     - `backgroundSrc` is a string ending `.png` **iff** `background` involves a photo, and
       `null` otherwise; the referenced file **exists on disk** (AC-19)
     - a `// @ts-expect-error` object literal typed `CardTemplate` with `qrZone` omitted
       (AC-07) — if `tsc` ever stops erroring there, the build fails
     - all seven taxonomy axes take **at least three distinct values** across the eight
       templates (the machine-checkable half of spec R-7)
  2. Run — fails, registry missing.
  3. Write `src/card/templates/palette.ts`: a `token()` helper resolving a token name to
     `var(--name)`. **Raw hex is permitted here only where §8B.3 names one explicitly**
     (`#123A31`) — and even that must be added to `tokens.css` by… no: **T02 owns
     `tokens.css`.** Use the nearest existing token, or if §8B.3's literal is genuinely
     required, place it in this file and **document it in the run-log as the one sanctioned
     F-01 exception under `src/card/templates/**`**, then flag it to T30 so `anti-ai-lint`
     allowlists exactly that path. Prefer a token.
  4. Write the eight template modules, one at a time, running the contract test after each.
  5. Generate the three background PNGs per overview §7 X-1 (procedural via `pngjs`,
     ≥ 800×1720, soft and photographic in character, **not** a flat gradient).
     Tag them `PLACEHOLDER-ART` in the run-log with a swap list for Vansh.
  6. Write `src/card/templates/index.ts`:
     `export const TEMPLATES: Record<TemplateId, CardTemplate> = { … }` plus
     `export const TEMPLATE_LIST = Object.values(TEMPLATES)` and
     `export const TEMPLATES_BY_CATEGORY`.
  7. Run the contract test — green. Paste output.
  8. Run `typecheck` + `lint` — exit 0.
  9. Append the outcome to the run-log, including the `PLACEHOLDER-ART` list.

- **Verification:**
  ```bash
  pnpm --filter web test tests/contract/templates.test.ts
  pnpm --filter web typecheck && pnpm --filter web lint
  ls -la apps/web/public/templates/
  ```
  Success: contract test green with all 8 keys · gates exit 0 · three PNGs ≥ 800×1720 exist.

- **Done when:** AC-07, AC-18, AC-19 green; the seven axes genuinely vary; `qrZone` is
  present on all eight; the three photo assets exist and load.

- **Do not touch:** `src/card/qr-zone.tsx` (T06), `src/card/card-*.tsx` (T13),
  `src/styles/tokens.css` (T02), `src/fixtures/**` (T04).

- **Traps:**
  - **`translucent-textured` (Passage) is the highest-risk fill in the system** (spec R-4).
    It must composite to **α ≥ 0.92** or T28's audit is measuring noise. Passage is also
    first on the §8B.3 cut list.
  - **Two reference templates fail AA and we rejected those exact pairings** (§8B.6):
    Boultont's white-on-peach and Artemis's grey-on-sage. Borrow the texture and the tonal
    idea; do **not** reproduce the pairing.
  - `textOnMedia: 'light'` over `photo` or `gradient-mesh` requires either a darkened
    overlay or a solid text panel. **T28's test decides, not your eye** — and when it fails,
    the template changes, never the threshold.
  - A template may decorate **around** the QR zone (hairline rules, corner ticks outside the
    reserved region, a caption below the plate, background art terminating at the reserved
    boundary). It may **never** paint inside the reserved region, change the plate, resize
    the symbol, or move the mark (§8A.4). QR-T3 fails the build if you do.

---

## T11 — `resolveCard` + `buildVcf`

- **Goal:** the single source of truth for preview **and** payload — the structural fix for
  the old build's "previewed file differs from sent file" bug.
- **Depends on:** T03, T04, T07  ·  **Wave 4**
- **Files:** `apps/web/src/card/resolve-card.ts`, `build-vcf.ts`, `errors.ts`;
  `apps/web/tests/unit/resolve-card.test.ts`, `tests/unit/build-vcf.test.ts` `[all new]`

- **Reference material:** spec §6.4 (`ResolvedCard`, the signature, the ordering rule, I-5),
  §5.3a (derived bio precedence and `ResolvedAvatar`), §5.6 (I-1…I-6), §6.7 (the vCard
  contract **with a concrete expected output** — assert against it byte for byte),
  §8A.6 (payload construction), §6.6 (masking, which the vCard must match).

- **The ordering rule (deterministic, so snapshots and vCards are stable):** sort by
  `FieldCategory` in declaration order (`IDENTITY, PERSONAL, WORK, BUSINESS, SOCIAL,
  FINANCIAL, CUSTOM`), then `FieldType` in declaration order, then `label` with
  `localeCompare('en-GB')`, then `id`.

- **Bio precedence (§5.3a):** first mapped `TEXT` → else `"{JOB_TITLE} at {COMPANY}"` →
  else `JOB_TITLE` → else `COMPANY` → else `null` (and the slot **collapses**, E-06).

- **Steps:**
  1. Write `tests/unit/resolve-card.test.ts`:
     - **purity (I-4):** two calls with the same inputs are deep-equal and the inputs are
       not mutated
     - **ordering:** a shuffled field array resolves to the exact declared order
     - **dangling ids (I-2):** an id absent from the profile lands in `droppedFieldIds`,
       not in `fields`, and does **not** throw (E-40)
     - **bio precedence:** all five branches of §5.3a
     - **avatar:** `PHOTO` field → `User.avatarUrl` → `monogram` (E-19)
     - **sensitive (I-6):** an `isSensitive` field **not** in `fieldIds` never appears
     - **empty:** `card_empty_demo` yields `fieldCount === 0` and `fields.length === 0`
     - **payload:** `qrPayload === `${SITE_URL}/c/${slug}`` and `≤ 60` bytes (AC-08)
     - **identity (I-5, AC-29):** `const r = resolveCard(...)`; assert that the object
       handed to a renderer and the object handed to `buildVcf` are `toBe`-identical —
       reference equality, not deep equality
  2. Run — fails.
  3. Write `src/card/errors.ts`: `EmptyCardError`, `ExportFailedError` (with
     `reason: 'font-not-loaded' | 'image-tainted' | 'unknown'`).
  4. Write `src/card/resolve-card.ts`. Look the template up via `TEMPLATES[card.templateId]`
     (T07). Split `SOCIAL_LINK` fields into `socialFields`. Exclude fields with `value: ''`
     entirely (E-07).
  5. Run — green.
  6. Write `tests/unit/build-vcf.test.ts` against the **exact fixture output in spec §6.7**
     for `card_ledger_demo` — compare the full string, CRLF and all. Then the degenerate
     table: zero fields **throws `EmptyCardError`**; `value: ''` omits the property entirely
     (never `TEL;TYPE=CELL:` with a blank); `,` `;` `\` escaped per RFC 2426; a 200-char
     `NOTE` folds at 75 octets with CRLF + a single space; financial values appear
     **masked**, matching what the card displays.
  7. Run — fails.
  8. Write `src/card/build-vcf.ts`. vCard 3.0, CRLF, `CHARSET=UTF-8`.
  9. Run — green. Paste both test summaries.
  10. Add the **AC-22 set-equality assertion**: the set of `FieldType`s present in the
      `.vcf` equals the set rendered visibly on the card (derive both from the same
      `ResolvedCard`).
  11. Run `typecheck` + `lint` — exit 0.
  12. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/unit/resolve-card.test.ts tests/unit/build-vcf.test.ts
  pnpm --filter web typecheck && pnpm --filter web lint
  ```
  Success: both files green, including the byte-for-byte §6.7 comparison and the
  `toBe`-identity assertion for I-5.

- **Done when:** AC-22, AC-23 green; AC-08 payload assertion green; I-2, I-4, I-5, I-6 each
  have a named test.

- **Do not touch:** `src/card/templates/**` (T07), `src/card/qr-*` (T06),
  `src/card/field-renderers.tsx` (T12), `src/fixtures/**` (T04).

- **Traps:**
  - **`buildVcf` throws on zero fields — it does not return a stub.** The old build shipped
    a **73-byte** name-only `.vcf` from card `5a286f9e`. The UI must block the action before
    reaching `buildVcf` (T23 blocks Save; T18 does not render the button at all). Making
    `buildVcf` "forgiving" re-opens the exact bug this run exists to close (E-01, E-02).
  - `resolveCard` must be **pure** — no `Date.now()`, no `Math.random()`, no reading
    `window`. I-4 is asserted.
  - Line folding is 75 **octets**, not 75 characters. Multi-byte UTF-8 counts as its bytes.
  - Do not re-derive the payload anywhere else. `qrPayload` is computed once, in
    `resolveCard`, and everything downstream reads it (T06, T18, T27).

---

## T12 — Field renderer registry (all 21 `FieldType`s)

- **Goal:** a `Record<FieldType, FieldRenderer>` so exhaustive that **omitting a field type
  is a compile error**, not a runtime blank.
- **Depends on:** T03, T04  ·  **Wave 4**
- **Files:** `apps/web/src/card/field-renderers.tsx` `[new]`,
  `apps/web/tests/contract/field-renderers.test.tsx` `[new]`

- **Reference material:** spec §6.6 (the full mapping table — transcribe every row),
  §7.3 (the security rule: financial types and `isSensitive` render **masked, always, on a
  public card, with no reveal control**), §8.8 (icon rules — three sizes only, 16/20/24,
  `aria-hidden` on decorative icons, no meaning carried by an icon alone).

- **Contract:** each renderer returns `{ icon, label, display, href | null }`.

- **Steps:**
  1. Write `tests/contract/field-renderers.test.tsx` asserting
     `Object.keys(FIELD_RENDERERS)` has all **21** members, then one behavioural assertion
     per row of §6.6: `tel:` / `mailto:` hrefs; `URL` display stripped of protocol and
     clamped to 34 chars; `SOCIAL_LINK` platform from hostname and `@handle` when parseable;
     unrecognised hostname → a **generic link glyph plus the hostname**, never an empty slot
     and never a crash (E-23); `ADDRESS` composed to 1–2 lines with a maps deep link;
     `PHOTO` returns no row at all (it is consumed by the avatar slot);
     `DATE` in `en-GB` long form; `LOCATION_TRACKING` → **a status chip, never a
     coordinate**; the three financial types → **`••••` + last 4** (AC-33).
  2. Run — fails.
  3. Write `src/card/field-renderers.tsx`, typed `Record<FieldType, FieldRenderer>` so a
     missing key is a `tsc` error (AC-21). Use `@/lib/format` (T04) for every display
     transform — do not re-implement formatting here.
  4. Run — green.
  5. Delete one entry temporarily and run `pnpm --filter web typecheck` to **prove** the
     compile error fires; restore it. Paste both outputs into the run-log — that is the
     evidence for AC-21.
  6. Run `typecheck` + `lint` — exit 0.
  7. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/contract/field-renderers.test.tsx
  pnpm --filter web typecheck && pnpm --filter web lint
  ```
  Success: 21 keys asserted · every §6.6 row has an assertion · the deliberate-omission
  `tsc` failure was captured and reverted.

- **Done when:** AC-21 green with evidence; AC-33's masking behaviour is asserted here as
  well as at the screen level.

- **Do not touch:** `src/lib/format.ts` (T04) — import it. `src/card/card-*.tsx` (T13).

- **Traps:**
  - Masking is **not** a display preference; it is a security rule (§7.3). There is **no
    reveal control on `/c/[slug]`**, ever. Reveal exists only in `/profile` (T25).
  - `PHOTO` never renders as a field row. If you emit one, the card gains a duplicate
    avatar.
  - Icons: exactly 16 / 20 / 24. No other size may appear anywhere in the app (§8.8).

---

## T13 — `<CardRenderer>` + card sub-components

- **Goal:** one renderer, three modes, the same universal skeleton for all eight templates —
  and **exactly one `[data-qr-zone]`** in every `full` or `export` render.
- **Depends on:** T06, T07, T11, T12  ·  **Wave 5**
- **Files:** `apps/web/src/card/{card-renderer,card-frame,card-avatar,card-button-stack,
  card-field-row,card-social-row}.tsx`, `card-fonts.ts`;
  `apps/web/tests/unit/card-renderer.test.tsx` `[all new]`

- **Reference material:** spec §6.5 (the props contract and the three-mode table), **§8B.1
  (the universal skeleton — slot order is fixed across all templates; a template varies art
  direction, not anatomy)**, §8A.2 (the vertical budget table and **the two-button
  divergence**), §8A.4 (the renderer computes the QR box; layering), §8A.5 (`thumb`),
  §8.4 (the card-only type families and how to scope them), §11 E-04, E-05, E-10, E-15,
  E-18, E-19, E-20, E-21, E-55, E-56.

- **The three modes (§6.5):**
  | mode | canvas | QR | used by |
  |---|---|---|---|
  | `full` | `400 × 860` design px, fluid down to `336 × 722` | **functional**, ≥ 140px, all of §8A | `/c/[slug]`, `/cards/[cardId]`, builder preview |
  | `thumb` | design canvas `transform: scale(s)`, `s ∈ [0.24, 0.5]` | **decorative glyph**, `aria-hidden`, encodes nothing | `/templates`, `/cards` tiles, dashboard |
  | `export` | offscreen `400 × 860` at `pixelRatio 2` → `800 × 1720` | **functional**, ≥ 280 device px | PNG export |

- **The slot order — fixed, all templates (§8B.1):**
  background → avatar → name → bio → **PROTECTED QR ZONE** → two action buttons → field row
  → social row.

- **Steps:**
  1. Write `tests/unit/card-renderer.test.tsx` asserting DOM shape only (never geometry):
     - the root carries `data-card-root`, `data-template-id`, `data-render-mode`
     - `full` and `export` contain **exactly one** `[data-qr-zone]` (I-3, AC-11)
     - `[data-qr-zone]` is the **last child** of the card root (§8A.4 layering)
     - **exactly two** action buttons in `full` mode (AC-20)
     - **no `PHONE` mapped ⇒ the WhatsApp button is absent, not disabled** (E-56), and the
       row collapses to one full-width button with no gap
     - `thumb` contains no `[data-qr-symbol]`
     - no `position: fixed` anywhere in the subtree (it breaks `export`, §6.5)
     - a 40+ char name wraps to **max 2 lines** then clamps, and a `title` attribute carries
       the full text (E-10)
     - a bio over 3 lines clamps at 3 with `title` (E-05)
     - null avatar → a monogram circle with 1–2 initials, **never a broken-image icon,
       never a grey blob, never an empty circle** (E-19)
  2. Run — fails.
  3. Write `card-fonts.ts`: load **Archivo** and **Bricolage Grotesque** via `next/font/google`
     here — **not in the root layout** — so the `/` and `(auth)` bundles never pay for them
     (N-3, AC-17). Export their CSS variables for the two card-only `typeFamily` values.
  4. Write `card-frame.tsx`: the 400×860 frame, `--radius-xl` (20px), `overflow: hidden`,
     `--elevation-0`, background per `TemplateBackground`. **`backgroundSrc` 404 ⇒ fall back
     to `palette.ground` and re-evaluate `textOnMedia` against that solid** (E-21, §9.4).
  5. Write `card-avatar.tsx`: 80px (72px at min width), explicit `width`/`height` reserved
     from first paint so CLS contribution is **0** (E-22); `onError` swaps to the monogram
     with **no layout shift** (E-20); `avatarKind: 'logo-mark'` renders a filled `markFill`
     circle carrying the monogram or the first letter of `COMPANY`.
  6. Write `card-button-stack.tsx`: **exactly two** buttons, 52px each, `--space-3` gap,
     styled by `buttonFill` / `buttonRadius` / `buttonIcon` / `buttonShadow`.
     `buttonShadow: 'soft'` → `--elevation-1` **inside the card root only** (the one
     sanctioned F-09 exception, declared in the schema so it is data, not a stray utility).
     A 40+ char label clamps to 1 line and the button height stays 52px (E-55).
  7. Write `card-field-row.tsx` (mapped non-social fields, compact; **scrolls within its own
     slot** at 25+ fields so the QR zone and buttons never move or shrink — E-04) and
     `card-social-row.tsx` (monochrome 24px glyphs inheriting `textOnMedia`).
  8. Write `card-renderer.tsx`: assemble the fixed skeleton, compute `cardWidth` with a
     **container query / `ResizeObserver`, never `transform: scale()` on `full` content**,
     and place `<QrZone>` as the last child at the template's `anchor`.
  9. Run the test file — green. Paste output.
  10. Run `typecheck` + `lint` + `build` — all exit 0.
  11. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/unit/card-renderer.test.tsx
  pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build
  grep -rn 'position:\s*fixed\|position-fixed\|fixed ' apps/web/src/card
  ```
  Success: tests green · three gates exit 0 · **the grep prints nothing** (fixed positioning
  breaks `html-to-image`).
  *(Real geometry, contrast and decode assertions are T27's and T28's job — they need a
  browser. Do not attempt them here.)*

- **Done when:** AC-11 and AC-20 green; the skeleton order matches §8B.1 for all eight
  templates; `thumb` encodes nothing; card-only fonts are scoped out of the root layout.

- **Do not touch:** `src/card/templates/**` (T07) — **if a template looks wrong, the fix
  belongs to T07 or to a Stage C fix round, not to you.** `src/card/qr-zone.tsx` (T06),
  `src/card/resolve-card.ts` (T11), `src/card/field-renderers.tsx` (T12).

- **Traps:**
  - **Two action buttons. Not four.** This is the deliberate divergence from every reference
    template (§8A.2): the protected QR zone claims the vertical space Linktree gives to its
    third and fourth buttons. Anyone asking "where are the other two buttons?" has found the
    divergence, not a bug. AC-20 asserts it.
  - **Never `transform: scale()` the `full` card's content.** Scaling scales the QR under
    the 140px floor and kills the card (E-25). `thumb` is the only mode that scales, and it
    is the mode with no real QR.
  - Content clamps **before** overflow. The QR zone has a `min-height` floor it never
    yields (E-18). A QR pushed off-canvas is a dead card — P0.
  - `overflow-wrap: anywhere` on field values, or a single 60-char token causes horizontal
    page scroll (E-15). Assert `scrollWidth <= clientWidth` on `[data-card-root]`.

---

## T15 — PNG export

- **Goal:** an 800×1720 PNG that **still decodes** — guarding the rasterisation path
  independently of the DOM path, because that is where silent QR failures hide.
- **Depends on:** T13  ·  **Wave 6**
- **Files:** `apps/web/src/card/export-card-png.ts` `[new]`,
  `apps/web/tests/unit/export-card-png.test.ts` `[new]`

- **Reference material:** spec §6.8 (the signature, the constraint that shapes the design
  system, the error shapes), §9.4 (`html-to-image` unavailable), E-43, E-44, §7.4
  (tainted-canvas: export only rasterises same-origin `/public` images).

- **Signature:** `exportCardPng(r: ResolvedCard, opts?: { pixelRatio?: 2 | 3 }): Promise<Blob>`
  · filename `contact-book-{slug}.png` · rejects with
  `ExportFailedError { reason: 'font-not-loaded' | 'image-tainted' | 'unknown' }`.

- **Steps:**
  1. Write `tests/unit/export-card-png.test.ts` (happy-dom, `html-to-image` mocked at the
     module boundary — the **real** rasterisation assertion is T27's QR-T6 in a real
     browser): resolves to a `Blob` of type `image/png`; the offscreen node is
     `400 × 860` and `pixelRatio` defaults to `2`; a thrown rasteriser rejects with
     `ExportFailedError` carrying the right `reason`; **a second call while the first is in
     flight is ignored** and exactly one blob is produced (E-43).
  2. Run — fails.
  3. Write `src/card/export-card-png.ts`. `await document.fonts.ready` before rasterising
     (a font swapping mid-raster is the `font-not-loaded` case). Always clear the busy flag
     in a `finally` — **the spinner is always cleared** (E-44).
  4. Run — green.
  5. Run `typecheck` + `lint` — exit 0.
  6. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/unit/export-card-png.test.ts
  pnpm --filter web typecheck && pnpm --filter web lint
  ```

- **Done when:** the in-flight guard is asserted; the error shapes match §6.8; the busy flag
  always clears.

- **Do not touch:** `src/card/card-renderer.tsx` (T13) — render it, do not modify it. The
  export button UI belongs to T22.

- **Traps:**
  - **`html-to-image` does not reliably rasterise `backdrop-filter`.** That is *why* §8A.3
    forbids it inside the card root and why the QR plate is an opaque solid rather than a
    frosted panel. If you find yourself wanting a blur, re-read §6.8.
  - `box-shadow` hairlines do not survive export either — hairlines are real `border`s
    (§8.7). Do not "improve" a border into a shadow.
  - Only same-origin `/public` images may be rasterised, or the canvas taints and the export
    silently fails (§7.4).

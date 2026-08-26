# PART 06 — VERIFICATION SUITES  ·  T27 · T28 · T29 · T30 · T31 · T32

> Track table: `00-overview.md`. **No step here is a commit step.**
>
> These six tracks build the suites the acceptance criteria name by file. They are executor
> tracks, not the Stage C tester dimensions — the testers (§5.2) *run* and *extend* what
> these tracks build.
>
> **Two rules bind every track in this file (spec §14.6):**
> 1. **Never weaken, skip, or delete an assertion to make it pass.** A failing QR-T5 means
>    the template is wrong, not the test.
> 2. **Never assert geometry in happy-dom.** It has no layout engine; every
>    `getBoundingClientRect` returns zeros and every such assertion is vacuously true.
>    Geometry, contrast and decode are **Playwright only**.
>
> And one that prevents the single most expensive false alarm in this run:
> **`thumb` mode is exempt from scannability (§8A.5).** Failing the gallery or a card tile
> for an unreadable QR is a misreading of the spec.

---

## T27 — The QR contract suite (QR-T1 … QR-T6)

> **This is the ground truth of the product.** Any failure here is **P0** — never deferred,
> never reclassified as polish, and never fixed by relaxing an assertion (§8A.7).

- **Depends on:** T13, T15, T18, T21  ·  **Wave 8**
- **Files:** `apps/web/tests/e2e/{qr-geometry,qr-plate,qr-overlap,qr-occlusion,
  qr-scannability,qr-export,qr-thumb-exempt}.spec.ts` `[all new]`
- **Reference:** spec **§8A in full**, §8A.7 (the six-test table), §16.1 R-2 (the flakiness
  mitigation — implement it, do not improvise), §14.3 (the matrix:
  8 templates × 3 viewports × 6 tests = **144 assertions minimum**).

- **Where the cards come from:** `/c/{slug}` for the 8 per-template fixture cards (T18) in
  `full` mode; `/cards` tiles (T21) for the `thumb` exemption. Do **not** build a bespoke
  test-harness route.

- **The six tests:**
  | # | File | Asserts |
  |---|---|---|
  | **QR-T1** | `qr-geometry.spec.ts` | per template × {360, 768, 1440}: `boundingBox()` of `[data-qr-symbol]` has `width === height` and `width >= 140`; the plate's box exceeds the symbol's by **≥ 16px on all four sides**; plate `border-radius <= 4px` |
  | **QR-T2** | `qr-plate.spec.ts` | via `getComputedStyle`: plate `background-color` **alpha === 1**; `background-image === 'none'`; `backdrop-filter === 'none'`; module/plate contrast **≥ 15:1**; **not inverted** (plate luminance > module luminance) |
  | **QR-T3** | `qr-overlap.spec.ts` | for **every other element** inside `[data-card-root]`, its `boundingBox()` does **not intersect** the reserved region. *This is the test that catches "a theme decorated over the QR" — the failure §8A exists to prevent.* |
  | **QR-T4** | `qr-occlusion.spec.ts` | `[data-qr-zone]` contains only the plate, the symbol and **at most one** `[data-qr-mark]`; if present, area ≤ **20%** of the symbol and clearance ≥ **2 modules** |
  | **QR-T5** | `qr-scannability.spec.ts` | screenshot `[data-qr-zone]`, decode with `jsqr`, assert **`decoded.data === resolved.qrPayload`, exactly**. **The ground-truth test.** |
  | **QR-T6** | `qr-export.spec.ts` | `exportCardPng()` output (800×1720) decodes to the **same** payload. Guards rasterisation independently of the DOM path — where silent QR failures hide. |
  | — | `qr-thumb-exempt.spec.ts` | `mode="thumb"` renders **NO decodable symbol** (AC-09(h)) — assert the negative, deliberately |

- **The R-2 mitigation, mandatory in every decode:**
  screenshot at `deviceScaleFactor: 2` with `animations: 'disabled'`, **after
  `await document.fonts.ready`** (use `gotoReady` from `tests/helpers/e2e.ts`); decode the
  **raw PNG buffer** via `pngjs` + `jsqr` (`decodeQrPng` in `tests/helpers/qr-decode.ts`),
  **never** a canvas re-encode; retry a decode **at most twice** and treat a third failure as
  real. If it still flaps: **raise the symbol floor from 140px to 160px in `qr-geometry.ts`
  and hand that change to T06's owner as a fix-round item — never relax the assertion.**

- **Steps:** ① write `qr-geometry.spec.ts` parameterised over
  `TEMPLATE_LIST × VIEWPORTS`, run it, read the failures → ② `qr-plate.spec.ts` →
  ③ `qr-overlap.spec.ts` → ④ `qr-occlusion.spec.ts` → ⑤ `qr-scannability.spec.ts` →
  ⑥ `qr-export.spec.ts` → ⑦ `qr-thumb-exempt.spec.ts` → ⑧ run the whole suite →
  ⑨ append to the run-log, **including a per-template × per-viewport pass table** (the
  final report needs it verbatim).

- **Verification:**
  ```bash
  pnpm --filter web test:qr
  ```
  Success: **every** template × viewport green across all six tests. Paste the full summary.
  A single red cell here blocks the run — it does not get deferred.

- **Done when:** AC-09 (a)–(h), AC-10 and AC-11 are green, with the pass table in the
  run-log.

- **Do not touch:** any source file. **If a template fails, that is a fix-round item for
  T07's files, not something you patch here.** If you find yourself editing
  `src/card/templates/*` or loosening a threshold, stop and return `NEEDS_DECISION`.

- **Traps:**
  - A failing QR-T3 usually means a template's decoration extends into the reserved region.
    The fix is the **template**, per §8A.4.
  - `qrPayload` bakes `NEXT_PUBLIC_SITE_URL` (default `http://localhost:3000`) even though
    Playwright serves on port 3100. Compare the decode against `resolved.qrPayload`,
    **never** against the live URL (overview §7 X-7).

---

## T28 — Per-template contrast, the 80/20 audit, and performance

- **Depends on:** T18, T19, T20, T21, T26  ·  **Wave 9**
- **Files:** `apps/web/tests/e2e/{template-contrast,eighty-twenty,perf}.spec.ts` `[all new]`
- **Reference:** spec **§8B.6** (the audit that can fail a beautiful template — read the
  five numbered steps and implement them exactly), §8.3 (the 80/20 discipline, quantified),
  §12.1 (N-1…N-7), AC-14, AC-16, AC-17.

- **`template-contrast.spec.ts` (AC-14), per template × per viewport:**
  1. Render the card in `full` mode.
  2. For each text node — **name, bio, both button labels, field labels, the QR caption** —
     take its `boundingBox()`.
  3. Screenshot that region and compute the **median luminance of the pixels beneath the
     text glyphs** (sample the background, excluding glyph pixels by luminance clustering —
     `medianLuminance` in `tests/helpers/pixels.ts`).
  4. Compute contrast against the node's computed `color`.
  5. **Assert ≥ 4.5:1**, or **≥ 3:1** where computed `font-size >= 24px`.

  Also assert: `buttonFill: 'translucent-textured'` composites to **α ≥ 0.92**;
  `textOnMedia: 'light'` over `photo` or `gradient-mesh` has either a darkened overlay or a
  solid text panel.

  > **This test must be capable of failing a template that is otherwise beautiful, and when
  > it does, the template changes — not the threshold.** A failing template is **P1** and is
  > fixed by darkening the ground, panelling the text, or changing the pairing. Relaxing the
  > assertion is explicitly forbidden (§14.6).

- **`eighty-twenty.spec.ts` (AC-16):** full-page screenshots of `/dashboard`, `/cards` and
  `/`; classify every pixel into the paper/ink family or the accent/signal family
  (`pixelFamilyShare` in `tests/helpers/pixels.ts`); assert **paper+ink ≥ 78%** and
  **accent+signal ≤ 22%**.

- **`perf.spec.ts` (AC-17, N-2…N-6):** **CLS === 0** on `/` and `/c/[slug]` via a
  `PerformanceObserver` on `layout-shift`; LCP on `/c/[slug]` < 1.5s; a builder interaction
  repaints within **one animation frame** over 20 rapid interactions (N-6); and the
  bundle assertion for **N-3** — parse the `next build` route table (or the build manifest)
  and assert **Archivo and Bricolage Grotesque do not appear in the `/` or `(auth)`
  bundles**, and First Load JS ≤ 165 kB for `/` and ≤ 180 kB for `/c/[slug]`.

- **Steps:** ① `template-contrast.spec.ts` → run → record which templates fail and
  **report them as fix-round items against T07** → ② `eighty-twenty.spec.ts` → run →
  ③ `perf.spec.ts` → run → ④ append to the run-log with the per-template contrast table and
  the measured pixel shares.

- **Verification:**
  ```bash
  pnpm --filter web exec playwright test tests/e2e/template-contrast.spec.ts tests/e2e/eighty-twenty.spec.ts tests/e2e/perf.spec.ts
  ```
- **Do not touch:** any source file. Template fixes belong to T07; token fixes belong to
  T02; both go through fix rounds.
- **Traps:** step 3 is the hard part. If the luminance clustering is measuring glyph pixels
  rather than the ground beneath them, the numbers will look implausibly high — sanity-check
  against a known-good template (Ledger, dark ink on `--paper`) before trusting a failure.

---

## T29 — Accessibility, keyboard traversal, and the state matrix

- **Depends on:** T16, T18, T19, T20, T21, T22, T23, T24, T25, T26  ·  **Wave 9**
- **Files:** `apps/web/tests/e2e/{a11y,keyboard,states}.spec.ts` `[all new]`
- **Reference:** spec §8D.1, §8D.3 (the per-screen state table), §6.1 (the route manifest
  and which states each route supports), §8.3 (the two-ring focus rule), §8.9 (reduced
  motion), AC-24…AC-27, E-48, E-49, E-54, R-9.

- **`a11y.spec.ts` (AC-25, AC-27):** `@axe-core/playwright`, **zero serious and zero
  critical** on **every route in §6.1 × every applicable `?state=` × viewport**.
  **Volume control (spec R-9):** run non-card routes at **360 and 1440 only**; card routes
  (`/c/[slug]`, `/cards/[cardId]`, `/cards/new`, `/templates`) get all three. Parallelise by
  Playwright project to stay inside the 10-minute budget (N-7).
  Also assert **AC-27** under `prefers-reduced-motion: reduce`: all five duration tokens
  compute to `0ms`; no scroll-driven transform occurs; the skeleton shimmer is static;
  nothing auto-advances.

- **`keyboard.spec.ts` (AC-26, E-48, E-54):** full traversal of the auth flow, the app shell,
  the builder and the public card page — **every interactive element reachable**, a
  **visible focus ring on each**, and that ring measures **≥ 3:1 against its ground on every
  surface including accent fills and photographic template backgrounds** (sample the pixels;
  do not trust the class name). Plus **200% zoom at 1280×1024**: no content loss and no
  horizontal scroll on `(app)` routes (E-54). Plus the skip link is the first focusable
  element and moves focus to `#main`.

- **`states.spec.ts` (AC-24):** for **every data screen** in §8D.3, visit all five `?state=`
  values and assert the correct `data-screen-state`; assert the **first-run empty and the
  filtered-to-nothing empty are different components with different copy and different
  actions**; assert loading renders **layout-matched skeletons with `aria-busy="true"` and
  no spinner**; assert `?state=banana` falls back to `success` and does not throw (E-34);
  assert `?state=loading` **never resolves and never also errors** (E-35).

- **Steps:** ① `states.spec.ts` (cheapest, catches the most) → run → ② `keyboard.spec.ts`
  → run → ③ `a11y.spec.ts` → run → ④ append to the run-log with the axe violation counts
  per route.

- **Verification:**
  ```bash
  pnpm --filter web exec playwright test tests/e2e/states.spec.ts tests/e2e/keyboard.spec.ts
  pnpm --filter web test:a11y
  ```
  Success: axe reports **0 serious, 0 critical** on every route × state × viewport.
- **Do not touch:** any source file.
- **Traps:** the focus-ring contrast check must sample **rendered pixels**, not computed
  `outline-color` — the whole point of the `ink → white → ground` sandwich (§8.3) is that it
  survives grounds a computed-style check cannot see.

---

## T30 — Static contract sweeps: anti-AI lint, routes, the scope wall

- **Depends on:** T16, T18, T19, T22, T23, T24, T25, T26  ·  **Wave 9**
- **Files:** `apps/web/tests/contract/{anti-ai-lint,routes,scope-wall}.test.ts` `[all new]`
- **Reference:** spec **§8C.1 (F-01 … F-17, with the detection method for each)**, §6.1 (the
  route manifest), §3.1 + §3.3 (the walls), AC-04, AC-05, AC-06, AC-15, AC-32.

- **`anti-ai-lint.test.ts` (AC-15, AC-32, AC-06)** — one assertion per row, all greps over
  `apps/web/src/**`:
  | # | Forbidden | Allowlist |
  |---|---|---|
  | F-01 | `#hex`, `rgb(`, `rgba(`, `hsl(`, `oklch(` | **only** `src/styles/tokens.css` (+ any path T07 explicitly registered and logged) |
  | F-02 | `Instrument Serif` + `Inter` | — |
  | F-03 | purple / violet / indigo / fuchsia | — (covered by F-01) |
  | F-04 | `gradient` | **only** `src/card/templates/**` |
  | F-05 | `backdrop-blur`, `backdrop-filter` | **nowhere — zero occurrences** |
  | F-06 | the icon-in-a-rounded-square-tinted-chip class shape | — (+ manual item M-2) |
  | F-07 | emoji as bullets/markers in JSX text | **only** `src/fixtures/**` |
  | F-08 | `✨`, `🚀`, `Powered by AI` | — |
  | F-09 | `shadow-*` utilities / `box-shadow` | **only** `src/components/overlay/**` (+ the declared `buttonShadow: 'soft'` path in `src/card/`) |
  | F-10 | `rounded-2xl`, `rounded-3xl` | **only** the mobile sheet component |
  | F-11 | `font-bold`, `font-semibold`, `font-extrabold`, `font-black`, `font-weight > 500` | **only** `src/card/templates/**` |
  | F-13 | the ten banned marketing phrases | grep `src/fixtures/marketing.ts` |
  | AC-06 | `fetch(`, `axios`, `useSWR`, `useQuery`, `localStorage`, `sessionStorage`, `document.cookie` | **only** the untouched `src/lib/api.ts` |
  | AC-32 | `dangerouslySetInnerHTML` (zero, anywhere) and every `target="_blank"` carrying `rel="noopener noreferrer"` | — |

  F-12 (`[data-reveal]` ≤ 6, never consecutive) and F-17 (≤ 3 centred sections) are DOM
  assertions and live in **T26's** `marketing.spec.ts` — assert here only that the marketing
  spec file exists and references them, so nothing silently disappears.

- **`routes.test.ts` (AC-05):** read `ROUTE_MANIFEST` from `tests/helpers/routes.ts` (T01)
  and assert that **every one of the 19 rows has the files §6.1 declares** — `page.tsx`
  present, `loading.tsx` present iff the row says ✓, `error.tsx` present iff the row says ✓ —
  by checking the filesystem. Assert `/cards/new/page.tsx` exists as a **static** segment
  alongside `/cards/[cardId]/page.tsx`.

- **`scope-wall.test.ts` (AC-04):** run `git status --short` (**read-only git — this is
  permitted**) and assert **every** changed/created path begins with `apps/web/` or `docs/`;
  assert **zero** paths under `apps/api/`, `packages/`, `.github/`, or the repo root except
  `pnpm-lock.yaml`. Assert `apps/web/src/lib/api.ts` is unmodified.

- **Steps:** ① `anti-ai-lint.test.ts`, one row at a time, running after each →
  ② `routes.test.ts` → ③ `scope-wall.test.ts` → ④ run all three → ⑤ append to the run-log
  with the per-rule violation counts (zeros included — the zeros are the evidence).

- **Verification:**
  ```bash
  pnpm --filter web test tests/contract/anti-ai-lint.test.ts tests/contract/routes.test.ts tests/contract/scope-wall.test.ts
  ```
  Success: three files green, every F-rule reporting **0 violations**.
- **Do not touch:** any source file. A violation is a fix-round item against whoever owns
  the offending path.
- **Traps:**
  - Do **not** widen an allowlist to make a rule pass. The allowlists above are the spec's,
    verbatim. A new path in an allowlist is a spec change and needs `NEEDS_DECISION`.
  - `git status` is fine. `git add`, `git checkout`, `git stash` are **forbidden** — even in
    a test.

---

## T31 — Edge-case suites: every row of §11

- **Depends on:** T16, T18, T20, T21, T22, T23, T24, T25  ·  **Wave 8**
- **Files:** `apps/web/tests/e2e/{edge-content,edge-interaction,routes}.spec.ts` `[all new]`
- **Reference:** spec **§11 in full — all 56 rows**; §10.3 `extremes.ts`; AC-34, AC-35,
  AC-36, AC-05.

- **Row assignment (spec §14.4):**
  - `edge-content.spec.ts` → **E-01 … E-23, E-53, E-55, E-56**
  - `edge-interaction.spec.ts` → **E-34 … E-52, E-54**
  - `routes.spec.ts` → **AC-05**: every §6.1 route responds 200 (or renders its declared
    not-found panel) under the Playwright server, and `/cards/new` resolves to the builder,
    not to `/cards/[cardId]` with `cardId="new"` (E-38)
  - **E-24 … E-33 belong to T27** — do not duplicate them.

- **The rows that are P0 and must not be softened:** E-01, E-02, E-04, E-10, E-15, E-17,
  E-18, E-48, E-53. Each of these is a documented product failure, not a hypothetical.

- **AC-35 — the worst realistic case, asserted explicitly:** at **360×800**, with the
  longest fixture name **and** the 25-field card **and** the tallest template
  *simultaneously*: `scrollWidth <= clientWidth` on `[data-card-root]`, **no vertical
  overflow past 722px**, and **the QR still decodes**.

- **Steps:** ① `routes.spec.ts` first (cheapest, and it catches wiring mistakes across every
  other track) → run → ② `edge-content.spec.ts`, one §11 row per test, named
  `E-NN — <scenario>` so the row-to-test map is mechanical → run → ③
  `edge-interaction.spec.ts`, same naming → run → ④ append to the run-log **with the
  explicit E-row → test-name table** (AC-34 requires the mapping to be stated in the final
  report).

- **Verification:**
  ```bash
  pnpm --filter web exec playwright test tests/e2e/routes.spec.ts tests/e2e/edge-content.spec.ts tests/e2e/edge-interaction.spec.ts
  ```
  Success: every §11 row owned by this track has a **named, passing** test, and the run-log
  carries the mapping table.
- **Do not touch:** any source file.
- **Traps:**
  - **E-31 is the trap row**: "a `thumb` render is checked for scannability" — the expected
    behaviour is that it is **asserted non-decodable**. Marking it P0 is a **false positive
    that wastes a fix round** (§11.4, severity P2).
  - **E-35**: `?state=loading` must render a skeleton **forever** — it must not spin *and
    also* error. That is the point of the state, not a bug.
  - **E-30**: `qrcode` throwing must still leave the action buttons working. A card without
    a QR must never be a blank card.

---

## T32 — Final integration & gate verification (read-only)

- **Goal:** run every gate and every suite end to end, from a clean state, and report the
  truth — including anything that is red.
- **Depends on:** T27, T28, T29, T30, T31  ·  **Wave 10**
- **Files:** **none.** This track writes nothing but its run-log block. It has **no
  `owns_files`** and therefore **cannot fix anything** — everything it finds red becomes a
  Stage C §5.3 fix-round item, clustered by the owning file.

- **Steps:**
  1. `pnpm install` (confirm the lockfile is coherent). Paste output.
  2. `pnpm --filter web typecheck` — **AC-01**. Paste output.
  3. `pnpm --filter web lint` — **AC-02**, zero errors **and zero warnings**. Paste output.
  4. `time pnpm --filter web build` — **AC-03** and **N-1** (< 180s). Paste the full route
     table; it is the evidence for N-2 and N-3.
  5. `pnpm --filter web test` — the whole Vitest suite (unit + contract). Paste the summary.
  6. `time pnpm --filter web test:e2e` — the whole Playwright suite. **N-7: < 10 minutes.**
     Paste the summary and the elapsed time.
  7. `pnpm --filter web test:qr` — re-run the QR gate on its own and paste the
     per-template × per-viewport table. **This is the line that matters most.**
  8. `git status --short` — **AC-04**: only `apps/web/` and `docs/` paths (plus
     `pnpm-lock.yaml`). Paste it verbatim.
  9. `git log -1 --oneline` — **AC-37**: must still be `a098b7c`. Paste it verbatim.
  10. `git diff --stat` — paste it for the final report.
  11. Score **every one of AC-01 … AC-37** met / partial / not-met **with the pasted
      evidence for each**. Do not mark an AC met without its command output.
  12. List every `PLACEHOLDER-ART` asset logged by T04 and T07 as a swap list for Vansh.
  13. List the three §8C.3 manual review items (M-1 asymmetry, M-2 no icon-chip grid,
      M-3 real imagery) and the §14.7 manual list — chiefly **scanning a card with a real
      phone camera**, which is item 1 on Vansh's checklist (§17.3) and the one thing `jsqr`
      cannot prove.
  14. Append all of it to the run-log.

- **Verification:** the pasted output of steps 2–10. **No claim without its command.**

- **Done when:** every AC is scored with evidence, the QR table is in the run-log, and
  `git log -1` is unchanged.

- **Do not touch:** **anything.** If a gate is red, report it — do not fix it. Fixing here
  would mean editing a file owned by another track, which is the one thing this plan is
  built to prevent.

- **Traps:**
  - **Never** run `git add`, `git commit`, `git stash`, `git checkout` or any deploy command
    — not even to "clean up" before measuring. `git status --short` showing a dirty tree is
    the **expected and required** end state (spec §17.4, AC-37).
  - A green local run with a stale `.next` cache is not evidence. If a result looks
    surprising, delete `apps/web/.next` and re-run before reporting.

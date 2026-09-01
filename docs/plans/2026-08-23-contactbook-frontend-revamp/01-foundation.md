# PART 01 — FOUNDATION  ·  T01 · T02 · T03

> Track table and wave schedule live in `00-overview.md`. Read §0 of that file first —
> it carries the Next 16 facts, the UI-only wall, the screen pattern and the no-commit
> override that every step below assumes.
> **Reminder: no step in this file is a commit step. The last step of every track is
> "append to `docs/runs/2026-08-23-contactbook-frontend-revamp/run-log.md`".**

---

## T01 — Toolchain, dependencies & test harness

- **Goal:** install every dependency the whole run needs, stand up Vitest and Playwright,
  and publish the shared test helpers — so that no later track ever has to touch
  `package.json`.
- **Depends on:** — (wave 1, alone)
- **Files:**
  - `apps/web/package.json` `[modify]`
  - `apps/web/tsconfig.json` `[modify]`
  - `apps/web/eslint.config.mjs` `[modify]`
  - `apps/web/next.config.ts` `[modify — only if a documented Next 16 option is required]`
  - `apps/web/.gitignore` `[modify]`
  - `apps/web/vitest.config.ts` `[new]`
  - `apps/web/playwright.config.ts` `[new]`
  - `apps/web/tests/setup.ts` `[new]`
  - `apps/web/tests/helpers/render.tsx` `[new]`
  - `apps/web/tests/helpers/e2e.ts` `[new]`
  - `apps/web/tests/helpers/qr-decode.ts` `[new]`
  - `apps/web/tests/helpers/pixels.ts` `[new]`
  - `apps/web/tests/helpers/routes.ts` `[new]`
  - `apps/web/tests/unit/harness.test.ts` `[new]`
  - `apps/web/tests/e2e/harness.spec.ts` `[new]`

- **Reference material (read first):**
  - Spec §9.3 — the exact dependency list and why each one is there.
  - Spec §17.2 — the exact commands and the four new scripts.
  - Spec §14.2, §14.3 — mock-vs-real policy and the 3-viewport matrix.
  - Spec §16.1 R-2 — the `jsqr` flakiness mitigation this harness must implement.
  - `apps/web/package.json`, `apps/web/eslint.config.mjs` as they stand today.

- **Dependencies to install (spec §9.3 — install ALL of them now, nobody else may):**
  - runtime: `@radix-ui/react-dialog`, `-popover`, `-select`, `-tabs`, `-tooltip`,
    `-dropdown-menu`, `-checkbox`, `-radio-group`, `-switch`, `-label`, `-accordion`,
    `-avatar`, `-toast`, `-visually-hidden`; `lucide-react`; `qrcode`; `html-to-image`;
    `clsx`; `tailwind-merge`
  - dev: `vitest`, `@vitejs/plugin-react`, `happy-dom`, `@testing-library/react`,
    `@testing-library/user-event`, `@testing-library/jest-dom`, `@playwright/test`,
    `@axe-core/playwright`, `jsqr`, `pngjs`, `@types/qrcode`, `@types/pngjs`
  - **No `zod`. No state library. No `next-themes`. No animation library.** (spec §9.3)

- **New scripts (spec §17.2):**
  ```json
  "test":     "vitest run",
  "test:e2e": "playwright test",
  "test:qr":  "playwright test tests/e2e/qr-",
  "test:a11y":"playwright test tests/e2e/a11y.spec.ts"
  ```
  `dev`, `build`, `start`, `lint`, `typecheck` are **unchanged**.

- **Steps (2–5 min each, TDD-ordered):**
  1. Read `apps/web/package.json` and `apps/web/node_modules/next/dist/docs/` index to
     confirm nothing here conflicts with Next 16.
  2. Write `apps/web/tests/unit/harness.test.ts` asserting `expect(1 + 1).toBe(2)` and one
     `@testing-library/jest-dom` matcher against a trivial rendered `<span>` — this is the
     failing test that proves the harness itself.
  3. Run `pnpm --filter web test` — confirm it fails with "vitest: command not found" (the
     right reason: nothing is installed yet).
  4. Add all runtime dependencies from the list above with
     `pnpm --filter web add <pkgs>`. Paste the resolved versions into the run-log.
  5. Add all dev dependencies with `pnpm --filter web add -D <pkgs>`.
  6. Add the four scripts to `apps/web/package.json`.
  7. Write `apps/web/vitest.config.ts`: `@vitejs/plugin-react`, `environment: 'happy-dom'`,
     `setupFiles: ['./tests/setup.ts']`, `include: ['tests/unit/**/*.test.{ts,tsx}',
     'tests/contract/**/*.test.{ts,tsx}']`, `exclude: ['tests/e2e/**']`, and
     `resolve.alias['@'] = path.resolve(__dirname, 'src')` so `@/…` works in tests.
  8. Write `apps/web/tests/setup.ts`: `import '@testing-library/jest-dom/vitest'` plus an
     `afterEach(cleanup)`.
  9. Run `pnpm --filter web test` — confirm **green**, 1 file, 2 assertions. Paste output.
  10. Write `apps/web/tests/e2e/harness.spec.ts` asserting `page.goto('/')` returns a
      response with a status < 500 — the smoke test that proves Playwright is wired.
  11. Run `pnpm --filter web test:e2e` — confirm it fails with "browserType.launch:
      Executable doesn't exist" (right reason).
  12. Write `apps/web/playwright.config.ts`:
      - `testDir: './tests/e2e'`, `fullyParallel: true`, `forbidOnly: true`, `retries: 0`
      - `use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' }`
      - `projects`: `vp-360` (`viewport 360×800`), `vp-768` (`768×1024`),
        `vp-1440` (`1440×900`) — all Chromium, all `deviceScaleFactor: 2`
      - `webServer: { command: 'pnpm exec next build && pnpm exec next start --port 3100',
        url: 'http://localhost:3100', timeout: 240_000, reuseExistingServer: true }`
      - `timeout: 45_000`, `expect: { timeout: 10_000 }`
  13. Run `pnpm --filter web exec playwright install chromium`. Paste output.
  14. Run `pnpm --filter web test:e2e` — confirm green on all three projects.
  15. Write `apps/web/tests/helpers/e2e.ts` exporting:
      - `gotoReady(page, url)` — `page.goto(url)` then
        `await page.evaluate(() => document.fonts.ready)` (spec §14.6, R-10)
      - `VIEWPORTS = [360, 768, 1440] as const`
      - `disableAnimations(page)` — adds a style tag zeroing all durations
  16. Write `apps/web/tests/helpers/qr-decode.ts` exporting
      `decodeQrPng(buffer: Buffer): string | null` — parse with `pngjs`, feed
      `Uint8ClampedArray` + width + height to `jsqr`, return `.data`. **Decode the raw PNG
      buffer; never round-trip through a canvas** (spec R-2). Also export
      `decodeWithRetry(fn, attempts = 3)`.
  17. Write `apps/web/tests/helpers/pixels.ts` exporting `medianLuminance(buffer, opts)` and
      `pixelFamilyShare(buffer, families)` — the primitives T28 needs for the §8B.6 contrast
      audit and the AC-16 80/20 audit. Pure functions over a `pngjs` bitmap.
  18. Write `apps/web/tests/helpers/render.tsx` exporting a `renderWithProviders()` wrapper
      (initially a plain `render` re-export; T04 does **not** modify it — it composes its own
      provider in its own tests).
  19. Write `apps/web/tests/helpers/routes.ts` exporting `ROUTE_MANIFEST` — the 19 rows of
      spec §6.1 as `{ id, path, group, hasLoading, hasError, states }`. T30 and T31 read it.
      **Transcribe §6.1 exactly; do not paraphrase.**
  20. Add `test-results/`, `playwright-report/`, `.playwright/` to `apps/web/.gitignore`.
  21. Add `"types": ["vitest/globals"]`-equivalent handling: prefer explicit imports from
      `vitest` in test files over globals, so `tsconfig.json` needs **no** `types` change.
      Only touch `tsconfig.json` if `tsc --noEmit` complains; if it does, note exactly what
      you changed and why.
  22. Run `pnpm --filter web typecheck` and `pnpm --filter web lint` — both must exit 0.
      If ESLint flags the `tests/` directory, add a scoped override in
      `eslint.config.mjs` rather than a blanket ignore.
  23. Append the outcome to `docs/runs/2026-08-23-contactbook-frontend-revamp/run-log.md`.

- **Verification (run all four, paste real output):**
  ```bash
  pnpm --filter web typecheck
  pnpm --filter web lint
  pnpm --filter web test
  pnpm --filter web test:e2e tests/e2e/harness.spec.ts
  ```
  Success looks like: `tsc` silent + exit 0 · eslint zero problems ·
  `Test Files 1 passed (1)` · `3 passed` (one per viewport project).

- **Done when:** every §9.3 package is in `apps/web/package.json`; the four new scripts
  exist; both runners execute a real test green; the five helper modules export the symbols
  named above; nothing outside `owns_files` changed.

- **Do not touch:** anything under `src/`. `apps/api/**`, `packages/**`, repo-root files,
  `apps/web/AGENTS.md`, `apps/web/src/lib/api.ts`.

- **Traps:**
  - `pnpm --filter web add` mutates the **root** `pnpm-lock.yaml`. That is expected and is
    the one sanctioned lockfile change (spec §3.3). Do not try to prevent it, and **never**
    `git checkout` the lockfile.
  - Do **not** create `tailwind.config.js`. Tailwind v4 is CSS-first here.
  - `@playwright/test` and `vitest` both define `expect`/`describe`. Keep them apart with
    the `include`/`exclude` globs in step 7 or you will get bizarre cross-runner errors.
  - `next build` inside `webServer` will fail until T02 lands (the scaffold `page.tsx`
    still builds fine today, so it should pass now — if it does not, report it, do not
    start editing `src/`).

---

## T02 — Design tokens, fonts, root layout, base CSS

- **Goal:** one palette, two typefaces, one token file, one `@theme inline` block, one
  focus rule — the entire visual substrate every other track consumes and none of them may
  edit.
- **Depends on:** T01
- **Files:**
  - `apps/web/src/styles/tokens.css` `[new]` — **the only file in the repo permitted a raw colour literal**
  - `apps/web/src/styles/globals.css` `[new]`
  - `apps/web/src/lib/tokens.ts` `[new]`
  - `apps/web/src/lib/cn.ts` `[new]`
  - `apps/web/src/lib/contrast.ts` `[new]`
  - `apps/web/src/app/layout.tsx` `[modify — keep the existing shape, replace fonts + metadata]`
  - `apps/web/src/app/globals.css` `[DELETE — superseded by src/styles/globals.css]`
  - `apps/web/src/app/page.tsx` `[DELETE — the scaffold home; `/` is rebuilt by T26 at `(marketing)/page.tsx`]`
  - `apps/web/public/{file,globe,next,vercel,window}.svg` `[DELETE — scaffold leftovers]`
  - `apps/web/tests/unit/contrast.test.ts` `[new]`
  - `apps/web/tests/contract/tokens.test.ts` `[new]`
  - `apps/web/tests/contract/contrast-sweep.test.ts` `[new]`

- **Reference material (read first, in this order):**
  - Spec §8.3 — every colour token, its role, and its **measured** ratio. Transcribe the
    hex values exactly; they were computed, not estimated.
  - Spec §8.4 — the type scale (14 steps), the responsive display endpoints, the
    two-domain weight policy.
  - Spec §8.5–§8.9 — spacing, radius, hairlines, elevation, iconography, motion.
  - Spec §6.2 — the `tokens.css` ⟷ `tokens.ts` contract.
  - The existing `apps/web/src/app/layout.tsx` — copy its shape exactly.

- **Steps:**
  1. Write `apps/web/tests/contract/tokens.test.ts`: read `src/styles/tokens.css` from disk,
     parse `--name: value;` pairs, and assert the parsed set is **key-for-key and
     value-for-value identical** to `TOKENS` from `src/lib/tokens.ts` (AC-12).
  2. Run `pnpm --filter web test tests/contract/tokens.test.ts` — confirm it fails with
     "Cannot find module '@/lib/tokens'".
  3. Write `apps/web/src/lib/contrast.ts`: `relativeLuminance(hex)`, `contrastRatio(a, b)`,
     both pure, WCAG 2.x formulas, no dependencies.
  4. Write `apps/web/tests/unit/contrast.test.ts` against known pairs: `#000/#FFF → 21`,
     `#14211C/#F7F1E6 → 14.78 ±0.02`, `#55655D/#F7F1E6 → 5.48 ±0.02`,
     `#65756D/#F7F1E6 → 4.33 ±0.02` (the salvaged value that **fails** AA — assert it fails,
     spec AS-09).
  5. Run it — confirm green. This helper is now trustworthy enough to gate the palette.
  6. Write `apps/web/src/styles/tokens.css` — every token from spec §8.3–§8.9 under `:root`:
     surfaces (4), inks (4), accents (4), rules (2), signals (7), focus (2), the 14 type
     steps with size/line-height/tracking, the 13 spacing steps, layout constants
     (`--sidebar-width: 240px`, `--sidebar-collapsed: 68px`, `--content-max: 1200px`,
     `--prose-max: 34em`, `--card-design-w: 400px`, `--card-design-h: 860px`,
     `--bottombar-height: 64px`), 7 radii, 3 hairlines, 3 elevations, 5 durations,
     4 easings, and `--qr-module: #0B0B0B` / `--qr-plate: #FFFFFF`.
  7. Write `apps/web/src/lib/tokens.ts` exporting the frozen `TOKENS` object shaped exactly
     as spec §6.2 declares (`surfaces`, `inks`, `rules`, `accents`, `signals`), with the
     `SurfaceToken` / `InkToken` / `RuleToken` / `AccentToken` / `SignalToken` string-literal
     unions.
  8. Run `pnpm --filter web test tests/contract/tokens.test.ts` — confirm **green** (AC-12).
  9. Write `apps/web/tests/contract/contrast-sweep.test.ts` (AC-13): for every
     (ink × surface) pair used for body text assert `≥ 4.5`; for every control-boundary pair
     assert `≥ 3.0`; assert `--ink-faint` (`#7C8B83`) appears in **zero** text-colour
     declarations by grepping `src/**/*.{ts,tsx,css}` for `color:.*ink-faint` and
     `text-\[var\(--ink-faint\)\]`.
  10. Run it — it should pass immediately if step 6 transcribed §8.3 correctly. **If a pair
      fails, the token is wrong — fix the token, never the threshold.**
  11. Write `apps/web/src/styles/globals.css`: `@import "tailwindcss";`
      then `@import "./tokens.css";` then **one** `@theme inline { … }` block mapping every
      token to a Tailwind v4 theme key (`--color-paper`, `--color-ink`, `--font-display`,
      `--font-ui`, `--spacing-*`, `--radius-*`, `--text-*`), then a base layer with:
      - `html { font-family: var(--font-ui); background: var(--paper); color: var(--ink); }`
      - the **single global focus rule**, implemented once and never reimplemented:
        `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px;
        box-shadow: 0 0 0 2px var(--focus-offset); }`
      - `text-wrap: balance` on display steps, `text-wrap: pretty` on body,
        `hyphens: none`, `overflow-wrap: anywhere` on `[data-field-value]`
      - the responsive display `clamp()`s from spec §8.4 (endpoints exactly as tabled)
      - the `@media (prefers-reduced-motion: reduce)` block from spec §8.9 **verbatim**,
        which zeroes all five duration tokens centrally (AC-27)
      - **No `.dark` block and no `prefers-color-scheme: dark` block** (NG4).
  12. Rewrite `apps/web/src/app/layout.tsx`, keeping `LayoutProps<"/">` and the
      CSS-variable font method. Load **only** the two product typefaces here:
      ```ts
      const newsreader = Newsreader({ subsets:['latin'], axes:['opsz'], display:'swap',
        variable:'--font-display', fallback:['Georgia','serif'] });
      const hanken = Hanken_Grotesk({ subsets:['latin'], display:'swap',
        variable:'--font-ui', fallback:['system-ui','Segoe UI','Helvetica Neue','Arial'] });
      ```
      Import `"@/styles/globals.css"`. Metadata: `title: { default: 'Contact Book',
      template: '%s · Contact Book' }`, a real description, `metadataBase` from
      `NEXT_PUBLIC_SITE_URL`. **Do not load Archivo or Bricolage Grotesque here** — they are
      card-only and T13 scopes them (N-3, AC-17).
  13. Delete `src/app/globals.css`, `src/app/page.tsx` and the five scaffold SVGs.
  14. Run `pnpm --filter web build`. It will now report `/` as **not found** — that is
      correct and expected until T26 lands. Confirm the build itself exits 0.
  15. Run `pnpm --filter web typecheck` and `lint` — both exit 0.
  16. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/contract/tokens.test.ts tests/contract/contrast-sweep.test.ts tests/unit/contrast.test.ts
  pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build
  grep -rEn '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(' apps/web/src --include=*.ts --include=*.tsx --include=*.css | grep -v 'src/styles/tokens.css'
  ```
  Success: 3 test files green · all three gates exit 0 · **the grep prints nothing** (F-01).

- **Done when:** AC-12 green, AC-13 green, the focus rule exists exactly once, the reduced-
  motion override exists exactly once, `--ink-faint` is used for zero text, and the grep in
  the verification block returns empty.

- **Do not touch:** `src/app/favicon.ico`, `apps/web/package.json` (T01 owns it — if you
  need a package, return `NEEDS_DECISION`), anything under `src/components`, `src/card`,
  `src/fixtures`, `src/types`.

- **Traps:**
  - The old build's `#65756D` muted ink **fails AA at 4.33:1**. Use `#55655D` (spec AS-09).
    If you find yourself typing `#65756D`, you are copying the wrong source.
  - `--rule` (`#D8CCB9`, 1.41:1) is **decorative only**. Control boundaries use
    `--rule-control` (`#8F7F66`, 3.46:1). Getting these backwards fails AC-13 and AC-25.
  - Two focus rings, not one — a single dark ring is invisible on `--accent`
    (2.19:1). The `ink → white → ground` sandwich is what clears 3:1 everywhere.
  - `next/font` variable fonts take **no `weight` property**. `axes: ['opsz']` is how you
    opt into optical sizing. Leave `adjustFontFallback` at its default `true` (AC-17/N-4).
  - Deleting `src/app/page.tsx` is required — leaving it would make two files resolve to
    `/` once T26 adds `(marketing)/page.tsx`, and the build would fail.

---

## T03 — Domain types & `CardTemplate` schema

- **Goal:** the two type modules that make whole classes of bug impossible to compile —
  a template without a QR, a `FieldType` without a renderer, a `TemplateId` without a
  template.
- **Depends on:** T01
- **Files:**
  - `apps/web/src/types/domain.ts` `[new]`
  - `apps/web/src/card/template-types.ts` `[new]`
  - `apps/web/tests/contract/domain-types.test.ts` `[new]`

- **Reference material:** spec §5.1 (the three enums, exactly as the old build defined
  them), §5.2 (seven entities and every field), §5.3a (`ResolvedAvatar`, derived bio),
  §5.6 (invariants I-1…I-6), §8A.4 (`QrAnchor`, `QrZoneSpec`), §8B.2 (the full
  `CardTemplate` schema — transcribe it verbatim).

- **Import direction (get this right or you create a cycle):**
  `template-types.ts` depends on **nothing**. `domain.ts` imports `TemplateId` **from**
  `template-types.ts`. Never the reverse.

- **Steps:**
  1. Write `apps/web/tests/contract/domain-types.test.ts` with a compile-time exhaustiveness
     assertion: a `const FIELD_TYPE_KEYS: Record<FieldType, true>` literal listing all 21
     members, plus `expect(Object.keys(FIELD_TYPE_KEYS)).toHaveLength(21)`. Add the same for
     `FieldCategory` (7) and `CardType` (4).
  2. Run `pnpm --filter web test tests/contract/domain-types.test.ts` — fails, module
     missing.
  3. Write `apps/web/src/card/template-types.ts`: `TemplateId` (8 ids), `TemplateCategory`,
     the six taxonomy unions, `TemplatePalette`, `QrAnchor`, `QrZoneSpec`, `CardTemplate`
     with **`qrZone` non-optional and no default** (AC-07), and
     `export declare const TEMPLATES: Record<TemplateId, CardTemplate>` — no, do **not**
     declare the registry here; T07 owns `templates/index.ts`. Export only types.
  4. Write `apps/web/src/types/domain.ts`: the three enums, the seven entities from §5.2,
     `FieldDetail` as a discriminated union of the four structured detail types,
     `ResolvedAvatar`, `ResolvedField`, `ResolvedCard` (spec §6.4 — every field including
     `droppedFieldIds` and `fieldCount`), `ScreenState`, `FixtureResult<T>`, `FixtureError`.
  5. Run the test — confirm green.
  6. Add to the same test file a **negative** type assertion proving `qrZone` cannot be
     omitted, using `// @ts-expect-error` above an object literal missing `qrZone` and typed
     `CardTemplate`. If `tsc` stops erroring there, `@ts-expect-error` itself fails the
     build — that is the mechanism (AC-07 is finally proved in T07's own test with the real
     registry; this is the early tripwire).
  7. Run `pnpm --filter web typecheck` — exit 0.
  8. Run `pnpm --filter web lint` — exit 0.
  9. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/contract/domain-types.test.ts
  pnpm --filter web typecheck
  ```
  Success: `Test Files 1 passed` · `tsc` exit 0 with the `@ts-expect-error` line still
  suppressing a real error.

- **Done when:** all 21 `FieldType`s, 7 `FieldCategory`s and 4 `CardType`s are declared;
  every §5.2 entity field is present with the exact name and nullability the spec gives;
  `CardTemplate.qrZone` is non-optional; `tsc` is clean.

- **Do not touch:** `src/card/templates/**` (T07), `src/card/qr-*.ts` (T06),
  `src/fixtures/**` (T04). Write **types only** — no runtime values, no constants except
  the enum-like string unions.

- **Traps:**
  - `ProfileField.value` is **always a string at the UI boundary** (§5.2). Do not model it
    as a union or an object.
  - `Contact.sourceCardSlug` is `string | null` and **may dangle** (E-39). Do not tighten it
    to a `ContactCard` reference.
  - `User.avatarUrl` is nullable — E-19 depends on it. Do not default it.
  - `ContactCard.fieldIds` replaces the old `CardFieldMapping` join. There is **no** join
    entity at the UI boundary.
  - `ContactCard.templateId` and `ContactCard.slug` are `[ASSUMED]` new fields (AS-02,
    AS-03) that the API will eventually need. Add a source comment saying so — that comment
    is the cross-boundary flag for the later integration run.

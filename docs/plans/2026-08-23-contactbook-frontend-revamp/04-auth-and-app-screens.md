# PART 04 — AUTH & THE AUTHENTICATED APP  ·  T16 · T20 · T21 · T22 · T23 · T24 · T25

> Track table: `00-overview.md`. **No step here is a commit step.**
>
> **Every track in this file uses the screen pattern from overview §0.5**: a server
> `page.tsx` wrapping a `'use client'` screen component in `<Suspense>`, because
> `useFixture` calls `useSearchParams`. The client component's root element **must** carry
> `data-screen-state`. Skip either half and AC-24, AC-25 and the build all fail.
>
> **Every track in this file implements all four state families of §8D.1**, reachable via
> `?state=loading|empty|error|offline` and defaulting to `success`. The per-screen table in
> §8D.3 says exactly what each state shows — follow it row by row.

---

## T16 — The `(auth)` group: six one-question screens

- **Goal:** a six-screen, one-question-per-page flow that is keyboard-operable end to end
  and never destroys a value on Back.
- **Depends on:** T04, T05, T13  ·  **Wave 6**
- **Files:** `apps/web/src/app/(auth)/layout.tsx`, `error.tsx`,
  `signin/phone/page.tsx`, `signin/otp/page.tsx`, `signup/first-name/page.tsx`,
  `signup/last-name/page.tsx`, `signup/email/page.tsx`, `signup/done/page.tsx`;
  `apps/web/src/components/auth/{auth-shell,auth-progress,otp-input,country-select,
  auth-step-form}.tsx`; `apps/web/src/lib/auth-validation.ts`,
  `apps/web/src/lib/auth-flow-context.tsx`;
  `apps/web/tests/unit/auth-validation.test.ts`, `tests/e2e/auth-flow.spec.ts` `[all new]`

- **Reference material:** spec §8D.2 (the shell, the six-row table, and the "rules for all
  six" paragraph — implement every clause), §4.3 (the journey), §7.1 (**there is no real
  auth** — client-side format validation only, no OTP sent, no token, no session, no guard),
  §11 E-46, E-47.

- **The six screens (§8D.2):**
  | # | Route | The one question | Control | Client-side validation | States |
  |---|---|---|---|---|---|
  | A-1 | `/signin/phone` | "What's your number?" | country-code `Select` + `tel` input, `inputMode="tel"` | non-empty, 6–15 digits, digits only | success, error |
  | A-2 | `/signin/otp` | "Enter the code we sent" | 6 auto-advancing boxes, paste-aware, `inputMode="numeric"`, `autoComplete="one-time-code"` | 6 digits | success, loading, error, 30s resend timer |
  | A-3 | `/signup/first-name` | "What's your first name?" | text, `autoComplete="given-name"` | 1–40 chars | success, error |
  | A-4 | `/signup/last-name` | "And your last name?" | text, `autoComplete="family-name"` | 1–40 chars | success, error |
  | A-5 | `/signup/email` | "Where can we reach you?" | email, `autoComplete="email"`, **visible "Skip for now" secondary** | RFC-ish shape | success, error |
  | A-6 | `/signup/done` | — | — | — | success only; live `thumb` + "Go to dashboard" |

- **Rules that apply to all six (each is an assertion):** headline `--type-display-2` ·
  helper `--type-body-lg` `--ink-muted` · **exactly one** primary action, full width on
  mobile · **Enter submits** · the first field is **focused on mount** · errors announced
  via `role="alert"` and referenced by `aria-describedby` · the step transition is a 16px
  horizontal slide + fade at `--dur-slow`, and **0ms under reduced motion** · **Back on
  every screen except step 1, and never destructive**.

- **Steps:**
  1. Write `tests/unit/auth-validation.test.ts` for `src/lib/auth-validation.ts`: phone
     (6–15 digits, digits only, rejects letters and spaces), OTP (exactly 6 digits), name
     (1–40 chars, rejects empty and 41), email (RFC-ish shape, rejects `a@`, accepts
     `a@b.co`).
  2. Run — fails. Write `auth-validation.ts`. Run — green.
  3. Write `auth-flow-context.tsx`: an in-memory `useReducer` holding the five answers.
     **No `localStorage`, no cookies** (§10.1). This is what makes Back non-destructive.
  4. Write `auth-shell.tsx` (`--paper`, single centred column `max-width: 420px`, vertically
     centred ≥ 768px, top-aligned with `--space-16` below; **right panel at ≥ 1280px showing
     one live `<CardRenderer mode="thumb">`** — the product, not a stock illustration) and
     `auth-progress.tsx` (6-segment hairline bar under `--type-overline` `STEP n OF 6`).
  5. Write `auth-step-form.tsx` — the shared question/headline/helper/error/primary/back
     skeleton all six pages fill in. One commit affordance per page.
  6. Write `country-select.tsx` (Radix Select from T05) and `otp-input.tsx`
     (six single-char boxes, auto-advance, backspace-retreat, **a pasted 6-digit code
     distributes across all six boxes and focuses the last** — E-47).
  7. Write `(auth)/layout.tsx` mounting the shell + the flow context, and `(auth)/error.tsx`
     rendering `ErrorPanel` with `scope: 'auth'`.
  8. Write the six `page.tsx` files, each a `<Suspense>` wrapper over its client step.
  9. Write `tests/e2e/auth-flow.spec.ts`: walk phone → otp → first → last → email → done
     using **keyboard only**; assert the first field is focused on mount at each step; type
     a value, press Back, assert **the value is still there** (E-46); paste `123456` into
     OTP box 1 and assert all six fill and focus lands on the last (E-47); assert the
     progress indicator reads `STEP n OF 6` at each step; assert Back is absent on step 1.
  10. Run `pnpm --filter web exec playwright test tests/e2e/auth-flow.spec.ts` — green on all
      three viewport projects.
  11. Run `typecheck` + `lint` + `build` — exit 0.
  12. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/unit/auth-validation.test.ts
  pnpm --filter web exec playwright test tests/e2e/auth-flow.spec.ts
  pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build
  ```
  Success: unit green · e2e green × 3 projects · three gates exit 0.

- **Done when:** AC-28 green — six screens, one question each, a progress indicator on every
  one, non-destructive Back on all but step 1, and values that survive Back.

- **Do not touch:** `src/app/(app)/**`, `src/app/(marketing)/**`, `src/components/{primitives,
  overlay,data,layout}/**`, `src/card/**`.

- **Traps:**
  - **No OTP is sent and no token is issued** (§7.1, NG3). If you write a `fetch`, you have
    broken the §3.1 wall. The "verify" button's loading state is a local `useState`.
  - No route guard, no middleware. `(app)` renders with the fixture user regardless (§7.2).
  - `autoComplete="one-time-code"` on the OTP field matters for iOS autofill and is part of
    the spec — do not drop it as noise.

---

## T20 — Dashboard `/dashboard`

- **Depends on:** T09, T10, T17  ·  **Wave 7**
- **Files:** `apps/web/src/app/(app)/dashboard/{page,loading,error,dashboard-client}.tsx`;
  `apps/web/tests/e2e/dashboard.spec.ts` `[all new]`
- **Reference:** spec §8D.3 dashboard row + the per-screen state table; §4.4 step 1.
- **Layout:** ≥1024px — 2-col: left = three stat blocks in a hairline-ruled row
  (Cards · Contacts · Fields), right = the **most recently updated card** as a live
  `<CardRenderer mode="thumb">` plus "Open builder"; below, a "Recent contacts" list of 5.
  ≤767px — stacked, **the card `thumb` first**.
- **States:** loading = 3 stat skeletons + one card-shaped skeleton · empty (first run) =
  "Nothing here yet" + "Create your first card" · filtered = n/a · error/offline = panel +
  retry.
- **Steps:** ① write `tests/e2e/dashboard.spec.ts` asserting `data-screen-state` for each of
  `?state=success|loading|empty|error|offline`, three stat blocks with `tabular-nums`, one
  `[data-card-root][data-render-mode="thumb"]`, and five contact rows → ② run, fails →
  ③ write `dashboard-client.tsx` (`'use client'`, `useFixture`, `ScreenStateRoot`) →
  ④ write `page.tsx` as the `<Suspense>` wrapper → ⑤ write `loading.tsx` + `error.tsx` →
  ⑥ run the spec, green → ⑦ `typecheck` + `lint` + `build` → ⑧ append to the run-log.
- **Verification:** `pnpm --filter web exec playwright test tests/e2e/dashboard.spec.ts`
  then the three gates. Success = green × 3 projects, gates exit 0.
- **Do not touch:** `src/components/app/**` (T17) — compose it. `(app)/layout.tsx` (T09).
- **Traps:** the dashboard's empty state is the **first-run** variant and must never render
  the filtered-to-nothing component (§8D.1, E-09).

---

## T21 — Cards list `/cards`

- **Depends on:** T09, T10, T17  ·  **Wave 7**
- **Files:** `apps/web/src/app/(app)/cards/{page,loading,error,cards-list-client}.tsx`;
  `apps/web/tests/e2e/cards-list.spec.ts` `[all new]`
- **Reference:** spec §8D.3 cards-list row; §4.4 step 2; E-09, E-13.
- **Layout:** page header + "New card" primary; a grid of `CardThumbTile` — 3-up ≥1280px,
  2-up 768–1279px, 1-up ≤767px.
- **The tile carries the fix for the old build's worst bug:** thumb · name · `CardType` chip
  · template name · **field-count badge**, with a **visible warning badge on any card
  mapping zero fields**.
- **States:** loading = a grid of **6 card-shaped skeletons at the real 1:2.15 aspect** ·
  empty (first run) = "You haven't made a card yet" + primary CTA · **empty (filtered)** =
  "No cards match that filter" + **"Clear filters"** — a *different component* · error =
  panel + retry.
- **Steps:** ① write `tests/e2e/cards-list.spec.ts` asserting all five `?state=` values;
  that the first-run and filtered empties render **different text and different actions**
  (AC-24); that `card_empty_demo`'s tile shows the zero-field warning badge; that a 40+ char
  name clamps to one line and the grid does not reflow (E-13); and that **no tile contains a
  decodable QR** — `[data-qr-mode="thumb"]` is present and `[data-qr-symbol]` is absent
  (AC-09(h)) → ② run, fails → ③ `cards-list-client.tsx` → ④ `page.tsx` +
  `loading.tsx` + `error.tsx` → ⑤ run, green → ⑥ gates → ⑦ append to the run-log.
- **Verification:** `pnpm --filter web exec playwright test tests/e2e/cards-list.spec.ts`
  + the three gates.
- **Do not touch:** `src/app/(app)/cards/[cardId]/**` (T22), `src/app/(app)/cards/new/**`
  (T23). You own **only** `cards/{page,loading,error,cards-list-client}.tsx` — note that
  your `loading.tsx` and `error.tsx` wrap the child segments too, so keep them generic.
- **Traps:** a `thumb` QR that does not scan is **correct** (§8A.5). Do not "fix" it.

---

## T22 — Card detail `/cards/[cardId]` + share / export / delete

- **Depends on:** T09, T10, T15, T17  ·  **Wave 7**
- **Files:** `apps/web/src/app/(app)/cards/[cardId]/{page,loading,error,not-found,
  card-detail-client}.tsx`; `apps/web/src/components/share/{share-sheet,export-png-button,
  delete-card-dialog}.tsx`; `apps/web/tests/e2e/card-detail.spec.ts` `[all new]`
- **Reference:** spec §8D.3 card-detail row; §6.4 **I-5**; §6.8, §6.9; §11 E-36, E-43, E-44.
- **Layout:** ≥1024px — 2-col: left = `<CardRenderer mode="full">` **pinned**; right =
  metadata, field list, actions (Edit · Share · Export PNG · Delete). ≤767px — stacked,
  card first.
- **The one architectural rule you must not break:** the `ResolvedCard` shown in the preview
  and the one handed to `buildVcf` / `exportCardPng` are **the same object reference**
  (I-5, AC-29). Resolve **once**, at the top of `card-detail-client.tsx`, and pass the
  reference down. **The share panel must not re-derive.** This is the structural fix for the
  old build's "previewed file differs from sent file" bug.
- **States:** loading = card-shaped skeleton + 5 field-row skeletons · **not-found** (invalid
  id) = the dedicated 404 panel, **not** an empty state (E-36) · error = panel + retry.
- **Steps:** ① write `tests/e2e/card-detail.spec.ts`: `?state=` matrix; an unknown
  `cardId` renders `NotFoundPanel` and not a raw 404 (E-36); the share sheet's previewed
  `.vcf` text equals the downloaded `.vcf` text; **tapping Export twice quickly downloads
  exactly one file and the button shows a busy state** (E-43); a forced export failure shows
  a retry toast and **always clears the spinner** (E-44); the delete dialog is destructive-
  styled and `Escape` closes it returning focus to the trigger (E-50) → ② run, fails →
  ③ `share-sheet.tsx` (Radix `Dialog` from T08; renders the `.vcf` preview from the **same**
  `ResolvedCard`) → ④ `export-png-button.tsx` (calls T15; in-flight guard; `finally`-clears
  the busy flag) → ⑤ `delete-card-dialog.tsx` (`ConfirmDialog` from T08) →
  ⑥ `card-detail-client.tsx` + `page.tsx` (`await params`!) + `loading` + `error` +
  `not-found` → ⑦ run, green → ⑧ gates → ⑨ append to the run-log.
- **Verification:** `pnpm --filter web exec playwright test tests/e2e/card-detail.spec.ts`
  + the three gates. Success also requires the I-5 identity assertion in T11's unit suite to
  still be green.
- **Do not touch:** `src/app/(app)/cards/page.tsx` (T21), `cards/[cardId]/edit/**` (T23),
  `src/card/**`, `src/components/app/**` (T17).
- **Traps:**
  - `params` is a **Promise**: `const { cardId } = await params;`.
  - Do **not** call `resolveCard` twice. Two calls means two objects, and I-5 is dead even
    though the values happen to match today.

---

## T23 — Card builder `/cards/new` + `/cards/[cardId]/edit`

> **This is the core loop of the product (§4.4) and it is designed directly against four
> recorded failures of the old build.** Read §8D.4 in full — including the table of old
> failures — before writing anything.

- **Depends on:** T09, T10, T17  ·  **Wave 7**
- **Files:** `apps/web/src/app/(app)/cards/new/{page,loading}.tsx`;
  `apps/web/src/app/(app)/cards/[cardId]/edit/{page,loading}.tsx`;
  `apps/web/src/components/builder/{builder-split,builder-header,template-picker,
  field-picker,theme-controls,empty-card-warning,builder-reducer}.ts(x)`;
  `apps/web/tests/unit/builder-reducer.test.ts`, `tests/e2e/builder.spec.ts` `[all new]`
- **Reference:** spec §8D.4 (the ASCII layout, the four old failures, the split ratios),
  §4.4, §6.4 (I-5), §11 E-01, E-40, E-42, AC-29, AC-36.

- **Layout:** desktop — preview ~46% / controls ~54%, the preview `position: sticky` and
  **never scrolling out of view**. Mobile — preview pinned to the top ~45vh with the
  controls scrolling beneath; the preview is **never pushed off-screen**.
- **Controls:** Radix `Tabs` — **Template** (3-up grid of live `thumb` previews; selected
  gets a 2px `--accent` ring + a tick), **Fields** (grouped by `FieldCategory`, a checkbox
  per `ProfileField`, sensitivity marker, live count, and an **"Add a field" deep link to
  `/profile`** — never an embedded editor), **Theme** (`buttonRadius`, `buttonFill`,
  `avatarKind`, `textOnMedia`).
- **Every interaction is live.** Ticking a field, picking a template or turning a theme knob
  updates the preview on the next frame. **There is no "apply", no "next", no wizard step,
  and exactly ONE commit affordance: Save.**
- **The zero-field guard (AC-36, E-01):** a persistent field-count meter in the header
  (`data-field-count`), a `--warning-wash` bar reading *"This card maps 0 fields. Anyone who
  scans it will only get your name."* with an **"Add fields"** action, and **Save `disabled`
  with `aria-disabled` and a stated reason**. The preview still renders name-only so the
  consequence is **visible, not hidden**.

- **Steps:**
  1. Write `tests/unit/builder-reducer.test.ts`: toggling a field id in/out; selecting a
     template; theme knobs; **dangling ids are dropped and surfaced as
     `droppedFieldIds`, never as a ghost row and never as a crash** (E-40); rapid template
     switching settles on the **last** selection with no stale state (E-42).
  2. Run — fails. Write `builder-reducer.ts` (a pure `useReducer` reducer). Run — green.
  3. Write `builder-header.tsx` (back link · inline-editable card name · `FieldCountMeter`
     from T17 · Save), `empty-card-warning.tsx`, `template-picker.tsx`, `field-picker.tsx`,
     `theme-controls.tsx`, `builder-split.tsx` (composing `SplitView` from T09).
  4. Write the two `page.tsx` files + their `loading.tsx`. `edit/page.tsx` must
     `await params`.
  5. Write `tests/e2e/builder.spec.ts`: at 360 / 768 / 1440 the **preview is visible without
     scrolling** (AC-29); ticking a field updates the preview with **no intermediate commit
     action**; selecting a template swaps it instantly; opening `/cards/card_empty_demo/edit`
     shows the warning bar, `data-field-count="0"`, and a **disabled Save with an
     `aria-disabled` explanation** (AC-36); 10 template clicks in 2s leave the preview on the
     last one (E-42); "Add a field" navigates to `/profile` rather than opening an inline
     editor.
  6. Run — green on all three projects.
  7. Run `typecheck` + `lint` + `build` — exit 0.
  8. Append the outcome to the run-log.

- **Verification:**
  ```bash
  pnpm --filter web test tests/unit/builder-reducer.test.ts
  pnpm --filter web exec playwright test tests/e2e/builder.spec.ts
  pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build
  ```
- **Do not touch:** `cards/[cardId]/{page,error,not-found}.tsx` (T22), `cards/page.tsx`
  (T21), `src/card/**`, `src/components/app/**`.
- **Traps:**
  - **No wizard. No steps. No "apply".** The old stepped builder failed precisely because it
    hid the result until the end (Q10).
  - **Do not embed a profile editor.** The old Step 2 put a 12-row profile editor inside the
    builder, giving one screen two competing commits. "Add a field" is a **link**.
  - **`templateId` is persisted on the card.** The old Step 3 taught a template choice and
    threw it away on Create. The preview shows the template from the first frame.
  - Any future tour anchor attaches to the **header**, which always exists — never to a tab
    panel that only exists while that tab is active.

---

## T24 — Contacts list + contact detail

- **Depends on:** T09, T10, T17  ·  **Wave 7**
- **Files:** `apps/web/src/app/(app)/contacts/{page,loading,error,contacts-list-client}.tsx`;
  `apps/web/src/app/(app)/contacts/[contactId]/{page,loading,error,not-found,
  contact-detail-client}.tsx`; `apps/web/tests/e2e/contacts.spec.ts` `[all new]`
- **Reference:** spec §8D.3 contacts rows; §4.6; E-39.
- **Layout:** list — search + category filter, then a hairline-ruled table
  (Name · Source card · Saved). **Width is why this screen is desktop-first (Q16).** ≤767px
  the same rows collapse to a stacked list and **table semantics are dropped**.
  Detail — 2-col: left = identity + avatar; right = captured fields grouped by category +
  a "From card {name}" link. Stacked on mobile.
- **States:** loading = 8 row skeletons · empty (first run) = "No saved contacts yet" **plus
  an explanation of how contacts arrive (a scan)** · **empty (filtered)** = "No contacts
  match" + **"Clear filters"** · error = panel + retry · detail not-found = the 404 panel.
- **Steps:** ① write `tests/e2e/contacts.spec.ts`: the five `?state=` values on both
  routes; the two empties are **different components with different copy and different
  actions**; at 360px the table has become a list (no `role="table"`); a contact whose
  `sourceCardSlug` dangles renders **no** "From card" link while the rest of the contact
  renders normally (E-39); an unknown `contactId` renders the not-found panel → ② run, fails
  → ③ the two client components → ④ the two `page.tsx` wrappers (`await params` on detail)
  + loading/error/not-found → ⑤ run, green → ⑥ gates → ⑦ append to the run-log.
- **Verification:** `pnpm --filter web exec playwright test tests/e2e/contacts.spec.ts`
  + the three gates.
- **Do not touch:** `src/components/data/data-table.tsx` (T10) — compose it.
- **Traps:** a saved contact is a **snapshot, not a live link** (§5.2). Do not resolve
  `SavedContactField`s back through the profile.

---

## T25 — Profile + field-group editor

- **Depends on:** T08, T09, T10, T17  ·  **Wave 7**
- **Files:** `apps/web/src/app/(app)/profile/{page,loading,error,profile-client}.tsx`;
  `apps/web/src/app/(app)/profile/groups/[groupId]/{page,loading,error,not-found,
  group-editor-client}.tsx`; `apps/web/src/components/profile/{identity-block,
  field-group-section,field-row,sensitive-toggle,add-field-popover}.tsx`;
  `apps/web/tests/e2e/profile.spec.ts` `[all new]`
- **Reference:** spec §8D.3 profile + field-group rows; §4.5; §5.3 (**a card is a filter
  over profile fields — editing the profile changes every card**); §7.3 (reveal exists
  **only here**, behind an explicit per-field toggle **that resets on navigation**);
  §11 E-08, E-40, E-41.
- **Layout:** profile — identity block, then one collapsible section per `FieldGroup`, each
  listing its `ProfileField`s with inline edit, a sensitivity toggle and "Add field".
  Sections are **collapsed by default on mobile**. Group editor — a focused editor for one
  group: reorder, add, edit, delete.
- **The delete rule (E-41):** deleting a `ProfileField` opens a `ConfirmDialog` that states
  **how many cards use it**, by name-count, before deleting. Afterwards E-40 applies —
  affected cards drop the id into `droppedFieldIds`, never a ghost row.
- **States:** loading = identity + 3 group skeletons · empty = a group with no fields shows
  "No fields in {group} yet" + "Add field" (E-08) · error = panel + retry · group not-found
  = the 404 panel.
- **Steps:** ① write `tests/e2e/profile.spec.ts`: the `?state=` matrix on both routes; a
  sensitive field renders with its marker and a **reveal toggle that resets after
  navigating away and back** (§7.3); deleting a field opens a confirm dialog whose body
  contains a card count (E-41); a group with zero fields shows the per-group empty state
  (E-08); an unknown `groupId` renders the not-found panel → ② run, fails → ③ the five
  profile components → ④ the two client components → ⑤ the two `page.tsx` wrappers
  (`await params` on the group route) + loading/error/not-found → ⑥ run, green → ⑦ gates →
  ⑧ append to the run-log.
- **Verification:** `pnpm --filter web exec playwright test tests/e2e/profile.spec.ts`
  + the three gates.
- **Do not touch:** `src/components/overlay/confirm-dialog.tsx` (T08) — compose it.
  `src/fixtures/**` (T04) — mutations live in a local `useReducer` and are **lost on
  reload, by design** (§5.7).
- **Traps:**
  - **This is the only surface with a reveal control.** Public cards never get one
    (AC-33). Do not export the toggle for reuse.
  - `FieldGroup`s are a fixed set seeded from `FieldCategory`; they are **renameable but not
    deletable** (§5.5).

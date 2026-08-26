# SPEC — Contact Book 2.0 Frontend Revamp (UI-only, ground-up)

- **Run ID:** `2026-08-23-contactbook-frontend-revamp`
- **Author:** dev-planner (from a 32-question interview with Vansh)
- **Status:** draft — awaiting Gate 1 approval
- **Plan:** `docs/plans/2026-08-23-contactbook-frontend-revamp-plan.md` (not written yet; Stage B)
- **Repo / branch:** `/Users/vanshmehta/Documents/Projects_2026/Contact-Book-2.0` @ `refac-new-build`
- **Target package:** `apps/web` only

> **This is the ONE spec file for the run.** No companion documents. The complete
> 32-question interview is Appendix A at the bottom of this file.
>
> Sections 1–17 are the protocol-canonical numbering and must not be renumbered —
> the orchestrator, executors and testers reference "spec §6", "spec §11", "spec §15"
> by number. Sections **§8A–§8D** are additional normative sections inserted between
> §8 and §9; they carry the material that makes this a frontend screen-making guide.

---

## ⚠ READ FIRST — REFERENCE STATUS (RESOLVED)

**Vansh's template reference images arrived while this spec was being written and have been
folded in. Template art direction is no longer `[ASSUMED]`.**

Six real Linktree templates were supplied and analysed: **Artemis, Balcombe, Boultont, Lane,
Smythe Sports**. They are authoritative for template anatomy, the button taxonomy, per-template
typeface freedom, and gallery presentation. Everything they determine is now normative in
**§8B**, and the extracted taxonomy is encoded verbatim in the `CardTemplate` schema (§8B.2).

Three findings from those references materially changed this spec, and are worth reading
before anything else:

1. **The card canvas changed shape.** The references are tall rounded frames at roughly
   **1 : 2.15** — phone-shaped mini pages, not landscape business cards. The card canvas is
   therefore **400 × 860 CSS px**, not the 3:4 tile originally sketched. Every geometry number
   in §8A is computed against that canvas.

2. **NOT ONE of the six references contains a QR code.** All six spend their entire vertical
   budget on a stack of 3–4 link buttons plus a social row. Contact Book's card is not a link
   page — its payload *is* the QR. **This is the one point where our system deliberately
   diverges from the reference**, and §8A.2 states the divergence and its cost explicitly:
   our card carries **exactly two action buttons**, not four, because the protected QR zone
   claims the vertical space Linktree gives to two or three of them.

3. **Two reference templates fail the accessibility bar we committed to.** Boultont's
   white-on-peach button text is well under 4.5:1; Artemis's tonal grey-on-sage is marginal.
   We borrow the *texture* and the *tonal idea* and reject those specific pairings. This forces
   a real requirement: the automated contrast audit must run **per-template, against the
   actually-rendered pixels beneath each text node**, and must be capable of **failing a
   template that is otherwise beautiful** (§8B.6, AC-14).

### Remaining open item

None that blocks Gate 1. The residual `[ASSUMED]` items are listed in §16.3 and are all
small, local decisions — chiefly the exact eight template names and the two cross-boundary
schema fields (`ContactCard.templateId`, `ContactCard.slug`) that the API will eventually
need.

---

## 1. Problem Statement

### 1.1 What Vansh asked for (verbatim)

> "I want you to analyze all three links … from a design perspective, as if you are a
> proper design engineer. I think it will be a full revamp. I wanted to analyze all these
> three links: the brand resources, how the templates that we'll be making will be made,
> the website view … the auth flow, how the auth flow will be, how the templates and cards
> will be made, what the view of the card builder will be. Analyse these things and come
> with a spec plan analyzing all these things. Make sure you are analyzing all the screens,
> not just the auth flow: all the web app screens, all the marketing websites, all the
> system states, all the public cards. Make sure you are making a proper frontend
> screen-making guide. It should be different plan.md that will be made here. The design
> system has already been given to you. … Just make sure each and every card that I am
> sharing with you explicitly has a QR code in it. Make sure you are making the design
> according to that itself. Each and every QR card should have a QR. … now it's very high
> time."

And, decisively, on the boundary of the work (Q5):

> "Our work is to just make the Ui nothing else API integration will be doing at last."

And on the marketing site (Q7):

> "See Marketing website will be just a normal one page scrollable website with different
> section not a very big headache but from the Ui perspective it should be the best modern
> but it should not look AI made."

### 1.2 Restatement in precise terms

`apps/web` is currently a bare `create-next-app` scaffold: four files, Geist fonts, the
string "Create Next App" in `<title>`, and a `globals.css` containing two colour variables
and a fake dark-mode block. There is no design system, no component library, no screen,
no card, no template, no QR. The previous build (on `origin/main`) had all of those and
they are being discarded because the design system "lost an argument with itself" — two
parallel palettes, four typefaces, elevation tokens declared and then set to `none`, and a
`.dark` block that mirrored light.

This run builds, from zero, the **entire visual and interaction layer** of Contact Book 2.0
in `apps/web`: a single coherent design system, an auth flow, the authenticated app, the
card template system, the card builder, the public card page and a one-page marketing site.

It builds **no data layer**. Every screen is driven by typed fixtures. API integration is a
separate, later run.

The single hardest constraint in the product is that **a Contact Book card's payload is a
QR code — a functional optical target, not a decoration.** None of the three design
references (Hinge brand resources, hinge.co, linktr.ee/s/templates) solves this. A QR that
a template has decorated over, shrunk, tinted or placed on a photograph is a card that does
not work. §8A exists to make that unbreakable and machine-verified.

### 1.3 Why now

Vansh: *"now it's very high time."* The monorepo was rebuilt from scratch three commits ago
(`29c3fd1 chore: rebuild monorepo from scratch`). The frontend is the only thing standing
between the rebuilt foundation and something reviewable. The API contract is already known
and stable from the old build, so the UI can be built confidently ahead of it.

---

## 2. Goals & Non-Goals

### 2.1 Goals (each observable)

- **G1** — A single, self-consistent design system exists as CSS custom properties in one
  file, with colour, type, spacing, radius, hairline, elevation, icon and motion tokens all
  named and all used. There is exactly one palette and exactly two typefaces.
- **G2** — Every text-on-surface token pair used for body text measures **≥ 4.5:1**, and
  every control-boundary pair measures **≥ 3:1**, asserted by an automated test, not by eye.
- **G3** — A six-screen, one-question-per-page auth flow exists and is keyboard-operable end
  to end.
- **G4** — The authenticated app exists behind a 240px collapsible left sidebar (bottom bar
  on mobile): Dashboard, Cards list, Card detail, Card builder, Contacts list, Contact
  detail, Profile with field-group editing.
- **G5** — 6–8 **named** card templates exist, each defined as a typed `CardTemplate` object
  in one registry, each rendering the same `ResolvedCard` correctly.
- **G6** — **Every template, at every supported viewport, produces a QR that a real decoder
  reads back to the exact expected payload.** This is proved by decoding a screenshot, not
  by inspecting CSS.
- **G7** — The card builder is a split view with a live preview that is the *same object* as
  the exported payload, so preview and output cannot diverge.
- **G8** — A public card page renders a card's own template full-bleed, with "Save to
  contacts" (.vcf) primary and "Message on WhatsApp" secondary.
- **G9** — A card exports to a shareable PNG at 2× that still decodes.
- **G10** — Every data screen implements all four state families: loading, empty/first-run,
  error/offline, success — and each is directly reachable and testable via a `?state=`
  switch.
- **G11** — A one-page scrollable marketing site exists with nine sections and passes the
  anti-AI-look rules in §8C.
- **G12** — A Linktree-modelled template gallery exists: left category rail, right grid of
  **live-rendered** template previews.
- **G13** — `pnpm --filter web typecheck`, `pnpm --filter web lint` and
  `pnpm --filter web build` all exit 0.
- **G14** — WCAG 2.2 AA on the app *and* on public cards: axe reports 0 serious/critical
  violations on every route × every state.

### 2.2 Non-Goals (things a reasonable engineer would assume are included, and are not)

- **NG1** — **No API integration of any kind.** No `fetch`, no server actions that hit a
  backend, no React Query / SWR, no auth session wiring, no cookies, no middleware guard.
  `apps/web/src/lib/api.ts` (the scaffold's `getHealth()`) is not extended and not called.
- **NG2** — No backend work. `apps/api` and `packages/*` are not modified. Prisma schema
  stays empty.
- **NG3** — No real OTP send/verify, no real phone validation against a gateway. The auth
  screens are UI with client-side format validation only.
- **NG4** — No dark mode (Q23). Light only, done properly.
- **NG5** — No internationalisation, no RTL, no locale routing. Copy is `en-GB`, hardcoded.
  (Non-Latin/RTL/emoji content was explicitly deselected in Q31.)
- **NG6** — No print-ready PDF export and no lock-screen card format (Q25 → v2).
- **NG7** — No analytics, telemetry, Sentry, or any third-party runtime script.
- **NG8** — No payment/billing implementation. The marketing pricing section is presentation
  only; its CTAs link to `/signin/phone`.
- **NG9** — No CMS. Marketing copy lives in a typed fixtures module.
- **NG10** — No visual-regression screenshot baselines (they rot and this is a first build).
  Geometry and decode assertions are used instead — they are stable and meaningful.
- **NG11** — No CI changes. `.github/workflows` is disabled (`91393d8`) and stays disabled.
- **NG12** — No commits, no pushes, no deploys, ever, by any agent.

---

## 3. Scope Walls

### 3.1 ██ THE HARD WALL: THIS RUN IS UI-ONLY ██

> **Vansh, Q5, verbatim: "Our work is to just make the Ui nothing else API integration
> will be doing at last."**
>
> **No executor may write a network call, a data-fetching hook, an auth guard, a server
> action that talks to a backend, a database query, an environment-variable-driven API
> client, or a mock server.**
>
> Every screen gets its data from a typed fixture module under
> `apps/web/src/fixtures/`, read through the fixture gateway in §6.3. If an executor
> finds itself reaching for `fetch`, the executor is off-plan and must stop and log a
> deviation instead.
>
> This wall is not a preference and it is not negotiable for convenience. It is the
> single scope decision that makes a build of this size finishable.

### 3.2 In scope (files this run creates or changes)

Everything under `apps/web/`:

```
apps/web/src/app/**                 all routes, layouts, loading, error files
apps/web/src/components/**          the component library
apps/web/src/card/**                card renderer, templates, QR zone, vCard, export
apps/web/src/styles/**              tokens.css and globals.css
apps/web/src/fixtures/**            all typed fixture data
apps/web/src/lib/**                 pure helpers (contrast, cn, format, state switch)
apps/web/src/types/**               domain + template types
apps/web/tests/**                   vitest + playwright suites
apps/web/package.json               new dependencies (§9.3) and new scripts (§17.2)
apps/web/next.config.ts             only if a documented Next 16 option is required
apps/web/public/**                  static assets (favicon, og image, sample portraits)
apps/web/vitest.config.ts           new
apps/web/playwright.config.ts       new
```

Two root-level files are also created for the test toolchain only if the runner demands
them; otherwise the repo root is untouched.

### 3.3 Out of scope — DO NOT TOUCH (hard wall for executors)

```
apps/api/**                         the NestJS backend, including prisma/schema.prisma
packages/types/**                   shared types package
packages/utils/**                   shared utils package
pnpm-workspace.yaml                 workspace config
package.json (repo root)            root scripts and engines
pnpm-lock.yaml                      only mutated as a side-effect of an approved install
.github/**                          CI stays disabled
apps/web/src/lib/api.ts             the scaffold health client — leave it exactly as is
apps/web/AGENTS.md                  written and re-added by `next dev`; never hand-edit
apps/web/CLAUDE.md                  one line: `@AGENTS.md`
./Modern Era.ttf, ./TiemposHeadline-Regular.ttf   see §16.1 R-6 — do not delete, do not use
```

`apps/web/src/app/page.tsx` and `apps/web/src/app/layout.tsx` **are** replaced — they are
create-next-app defaults, not work product.

### 3.4 Deferred to v2

- API integration, real auth, real OTP, session management.
- Print-ready PDF export; iOS/Android lock-screen card format (Q25).
- Dark mode (Q23).
- i18n / RTL / non-Latin content handling (Q31).
- Contact import from device, NFC tap-to-share, card analytics.
- Payments and plan enforcement behind the pricing section.

### 3.5 Cutting order, if Stage C must cut (Q27)

1. **Cut first: the marketing site** (`(marketing)/page.tsx` and its sections) — it is the
   only surface that is not the product.
2. Cut second: the template gallery route (`/templates`).
3. Cut third: PNG export (`export` render mode).
4. **NEVER CUT: the card system, the QR contract, the card builder, the public card page.**
   Vansh, Q27: those *are* the product. A run that ships the marketing site and a broken QR
   has failed.

---

## 4. Users & Journeys

### 4.1 Roles

| Role | Auth state | What they can reach |
|---|---|---|
| **Visitor** | none | `/`, `/templates`, `/c/[slug]`, all of `(auth)` |
| **Owner** | signed in (simulated) | all of `(app)`, plus everything a Visitor can reach |
| **Scanner** | none, arrives from a camera | `/c/[slug]` only — never sees app chrome |

There is no admin role and no sharing-permission model in this run.

### 4.2 Primary happy path — "a card gets scanned and saved"

1. Scanner points a phone camera at a printed or on-screen Contact Book card.
2. The QR resolves to `{SITE_URL}/c/{slug}`; the browser opens the **public card page**.
3. The page renders that card in **its own template**, full-bleed, mobile-first, with the
   owner's name at `display-3`, the selected profile fields beneath, and the QR still
   present in its protected zone (a scanned card is also a re-shareable card).
4. Scanner taps the primary action **"Save to contacts"**. A `.vcf` file containing exactly
   the fields the card maps — no more — downloads and the OS contact importer opens.
5. Scanner optionally taps the secondary action **"Message on WhatsApp"**, which opens
   `https://wa.me/{e164}` in a new tab.
6. Nothing is created on Contact Book's side. The scanner never signs up.

### 4.3 Secondary journey A — "a visitor becomes an owner"

1. Visitor lands on `/`, scrolls the one-page marketing site, reaches a CTA.
2. `/signin/phone` — country code select + phone input. One question. Continue.
3. `/signin/otp` — six-digit OTP, auto-advancing boxes, resend timer. Continue.
4. `/signup/first-name` → `/signup/last-name` → `/signup/email` — one question per page,
   progress indicator visible throughout, Back always available and never destructive.
5. `/signup/done` — confirmation, then into `/dashboard`.

### 4.4 Secondary journey B — "an owner builds a card" (the core loop)

1. `/dashboard` shows card count, contact count, and the owner's most recently updated card
   as a live-rendered `thumb`.
2. `/cards` lists every card as a `thumb` tile with its name, type, template name and — the
   fix for the old build's worst bug — its **field count**, with a visible warning badge on
   any card mapping **zero** fields.
3. Owner opens `/cards/new`. The **builder** is a split view: on one side a pinned, live
   `full`-mode card preview; on the other, three control groups — Template, Fields, Theme.
4. Selecting a template swaps the preview instantly. Ticking a profile field adds it to the
   preview instantly. There is no wizard, no hidden step, and no "apply" button.
5. The builder shows a persistent field counter and blocks the primary "Save card" action
   while the count is zero, with an inline explanation (§11 E-01).
6. Owner opens the Share panel: the preview shown *is* the object that would be exported —
   the same `ResolvedCard` instance — so the previewed `.vcf` and the downloaded `.vcf`
   cannot differ.
7. Owner exports a PNG for WhatsApp; the exported image still decodes.

### 4.5 Secondary journey C — "an owner curates their profile"

1. `/profile` shows the owner's identity and their field groups by `FieldCategory`.
2. Owner adds a `ProfileField` to a group. Because **a card is a filter over profile
   fields**, that field immediately becomes available to tick in every card builder.
3. Owner marks a field sensitive; it renders with a sensitivity marker in the builder and is
   excluded from any card the owner has not explicitly mapped it into.

### 4.6 Secondary journey D — "an owner reviews saved contacts"

1. `/contacts` lists saved contacts with search + category filter.
2. `/contacts/[contactId]` shows the contact's captured fields and the card they came from.

---

## 5. Domain & Data Model

All types below live in `apps/web/src/types/domain.ts` and are **frontend-only mirrors** of
the shapes mined from the previous build. No Prisma, no DB, no persistence in this run.

### 5.1 Enumerations (exactly as the old build defined them)

```ts
export type CardType = 'BUSINESS' | 'PERSONAL' | 'PAYMENT' | 'CUSTOM';

export type FieldCategory =
  | 'IDENTITY' | 'PERSONAL' | 'WORK' | 'BUSINESS'
  | 'SOCIAL' | 'FINANCIAL' | 'CUSTOM';

export type FieldType =
  | 'PHONE' | 'LANDLINE' | 'FAX' | 'EMAIL' | 'ADDRESS' | 'URL' | 'SOCIAL_LINK'
  | 'PHOTO' | 'TEXT' | 'DATE' | 'JOB_TITLE' | 'COMPANY' | 'REG_NUMBER'
  | 'DEPARTMENT' | 'RELATION' | 'STATUS' | 'LOCATION_TRACKING'
  | 'BANK_ACCOUNT' | 'DIGITAL_WALLET' | 'CRYPTO_WALLET' | 'CUSTOM';
```

`FieldType` has 21 members. **Every one of them must have a renderer** (§6.6, AC-21) and a
vCard mapping (§6.7). A missing renderer is a build-time type error, not a runtime blank.

### 5.2 Entities

| Entity | Fields | Notes |
|---|---|---|
| `User` | `id: string`, `email: string \| null`, `phone: string`, `countryCode: string`, `firstName: string`, `lastName: string`, `isActive: boolean`, `profileOnboardingCompletedAt: string \| null`, `avatarUrl: string \| null` | `avatarUrl` is nullable — §11 E-19 depends on it |
| `FieldGroup` | `id: string`, `userId: string`, `category: FieldCategory`, `name: string`, `fieldIds: string[]` | one group per category is typical, not enforced |
| `ProfileField` | `id: string`, `groupId: string`, `type: FieldType`, `label: string`, `value: string`, `isSensitive: boolean`, `detail?: FieldDetail` | `value` is always a string at the UI boundary |
| `FieldDetail` | discriminated union: `AddressDetail \| BankAccountDetail \| DigitalWalletDetail \| CryptoWalletDetail` | present only for the four structured types |
| `ContactCard` | `id: string`, `userId: string`, `name: string`, `type: CardType`, `isSensitive: boolean`, `slug: string`, `templateId: TemplateId`, `fieldIds: string[]`, `updatedAt: string` | `fieldIds` replaces the old `CardFieldMapping` join at the UI boundary |
| `Contact` | `id: string`, `ownerId: string`, `displayName: string`, `sourceCardSlug: string \| null`, `savedAt: string`, `fields: SavedContactField[]` | saved-contact snapshot |
| `SavedContactField` | `type: FieldType`, `label: string`, `value: string` | denormalised on purpose; a saved contact is a snapshot, not a live link |

### 5.3 The one structural fact that drives the entire card UI

> **A card owns no data. A card is a filter over `ProfileField`s.**
> `ContactCard.fieldIds` is a subset of the ids reachable through the user's `FieldGroup`s.
> `ContactCard.name` and `ContactCard.type` are the only content a card owns.

Two consequences the builder UI must make impossible to get wrong:

1. **A card with `fieldIds.length === 0` renders a name and nothing else.** In the old build
   this shipped: card `5a286f9e` had zero mappings and produced a **73-byte** `.vcf`
   containing only `FN` and `N`. See §11 E-01/E-02 and AC-36.
2. **Editing the profile changes every card.** Removing a `ProfileField` that a card maps
   must remove it from that card's render, not leave a ghost. See §11 E-03.

### 5.3a Avatar and bio are DERIVED, not owned (reference-driven)

The supplied references establish a fixed card skeleton — *avatar → name → bio → (our QR zone)
→ actions → social row*. That introduces two pieces of content the domain model does not have
a column for. Both are **derived**, so §5.3's "a card owns no data" invariant survives intact:

- **`ResolvedCard.bio`** — derived, in this precedence order:
  1. the value of the first mapped `ProfileField` of type `TEXT`;
  2. else `"{JOB_TITLE} at {COMPANY}"` if both are mapped;
  3. else `JOB_TITLE` alone, else `COMPANY` alone;
  4. else `null` — and the template collapses the bio slot rather than reserving empty space.
  Rendered at a maximum of **3 lines**, then hard-clamped (§11 E-05).

- **`ResolvedCard.avatar`** — a discriminated union, derived:
  ```ts
  type ResolvedAvatar =
    | { kind: 'photo';    url: string; alt: string }
    | { kind: 'monogram'; initials: string }   // 1–2 chars, from firstName/lastName
  ```
  Source: the mapped `PHOTO` field's value, else `User.avatarUrl`, else `monogram`.

- **`CardTemplate.avatarKind`** decides how the slot is *presented*, not what is in it.
  `'photo'` renders the circular image (monogram fallback when absent, §11 E-19).
  `'logo-mark'` renders a filled circle in the template's accent carrying the monogram or the
  first letter of `COMPANY` — this is exactly what **Artemis** does with its script logotype,
  and it is why the avatar slot must accept a logotype and not only a face.

### 5.4 Relationships & ownership

```
User 1──n FieldGroup 1──n ProfileField
User 1──n ContactCard
ContactCard n──n ProfileField   (via ContactCard.fieldIds; the old CardFieldMapping)
ContactCard 1──1 CardTemplate   (via ContactCard.templateId; see the [ASSUMED] note below)
User 1──n Contact 0──1 ContactCard  (via Contact.sourceCardSlug, weak, may dangle)
```

**`[ASSUMED]` — `ContactCard.templateId` is a new field.** The old schema had no template
column, which is precisely why the old wizard "taught a template choice that was thrown away
on Create". This UI persists a template per card, so **the API will need a `templateId`
column when integration happens.** Flagged here because it crosses the boundary this run is
otherwise forbidden from touching.

**`[ASSUMED]` — `ContactCard.slug` is a new field.** The public card URL needs a stable,
short, non-enumerable identifier. Constraint from §8A.7: **slug length ≤ 24 characters**, so
the QR payload stays under 60 bytes and the symbol stays at or below version 6.

### 5.5 Lifecycle (UI-level only)

| Entity | Create | Update | Delete | Archive |
|---|---|---|---|---|
| `ContactCard` | `/cards/new` builder, optimistic in local state | builder, live | confirm dialog, "Delete card", destructive styling | not in this run |
| `ProfileField` | `/profile` inline add within a group | inline edit | confirm dialog + a warning naming **how many cards use it** | not in this run |
| `FieldGroup` | fixed set seeded from `FieldCategory` | rename only | not deletable | not in this run |
| `Contact` | not creatable in-app (arrives from a scan) | not editable | delete with confirm | not in this run |
| `User` | auth flow | `/profile` identity block | not in this run | not in this run |

### 5.6 Invariants (assert these in tests, §14.4)

- **I-1** — `ContactCard.templateId` always resolves to a member of the template registry.
- **I-2** — `ContactCard.fieldIds` contains no id that is absent from the user's profile;
  the resolver drops dangling ids silently and reports the drop count to the builder UI.
- **I-3** — Every rendered card, in `full` or `export` mode, contains exactly one
  `[data-qr-zone]` element.
- **I-4** — `resolveCard()` is pure and referentially transparent: same inputs, deep-equal
  output.
- **I-5** — The object passed to `<CardRenderer>` and the object passed to `buildVcf()` are
  **the same `ResolvedCard` reference** in the share panel. This is the structural fix for
  the old build's "previewed file differs from sent file" bug.
- **I-6** — A `ProfileField` with `isSensitive: true` is never included in a `ResolvedCard`
  unless its id is explicitly in `ContactCard.fieldIds`.

### 5.7 What must survive a crash

**Nothing.** There is no persistence layer in this run. Fixture state lives in React state
and resets on reload. This is deliberate and is stated so no executor reaches for
`localStorage` "to be helpful" — that would be the first crack in the §3.1 wall.

---
## 6. Interfaces & Contracts

There is no HTTP surface in this run (§3.1). The contracts below are **module and component
contracts**, and they are the ones the `contract` test dimension verifies field by field.

### 6.1 Route manifest (the authoritative list — one row per route)

`m` = mobile ≤ 767px · `d` = desktop ≥ 1024px. **States** are the four families from §8D.1.

| # | Route | Group | Params | Render | `loading.tsx` | `error.tsx` | States |
|---|---|---|---|---|---|---|---|
| R-01 | `/` | `(marketing)` | — | static | — | ✓ | success only |
| R-02 | `/templates` | `(marketing)` | — | static | ✓ | ✓ | all 4 |
| R-03 | `/signin/phone` | `(auth)` | — | static | — | ✓ | success, error |
| R-04 | `/signin/otp` | `(auth)` | — | static | — | ✓ | success, error, loading |
| R-05 | `/signup/first-name` | `(auth)` | — | static | — | ✓ | success, error |
| R-06 | `/signup/last-name` | `(auth)` | — | static | — | ✓ | success, error |
| R-07 | `/signup/email` | `(auth)` | — | static | — | ✓ | success, error |
| R-08 | `/signup/done` | `(auth)` | — | static | — | ✓ | success |
| R-09 | `/dashboard` | `(app)` | — | static | ✓ | ✓ | all 4 |
| R-10 | `/cards` | `(app)` | — | static | ✓ | ✓ | all 4 |
| R-11 | `/cards/new` | `(app)` | — | static | ✓ | ✓ | all 4 |
| R-12 | `/cards/[cardId]` | `(app)` | `cardId` | dynamic | ✓ | ✓ | all 4 + not-found |
| R-13 | `/cards/[cardId]/edit` | `(app)` | `cardId` | dynamic | ✓ | ✓ | all 4 + not-found |
| R-14 | `/contacts` | `(app)` | — | static | ✓ | ✓ | all 4 |
| R-15 | `/contacts/[contactId]` | `(app)` | `contactId` | dynamic | ✓ | ✓ | all 4 + not-found |
| R-16 | `/profile` | `(app)` | — | static | ✓ | ✓ | all 4 |
| R-17 | `/profile/groups/[groupId]` | `(app)` | `groupId` | dynamic | ✓ | ✓ | all 4 + not-found |
| R-18 | `/c/[slug]` | root | `slug` | dynamic | ✓ | ✓ | all 4 + not-found |
| R-19 | `/not-found` | root | — | static | — | — | — |

**Next 16 conventions verified against `apps/web/node_modules/next/dist/docs/`:**

- `params` is a **`Promise`** and must be awaited:
  `const { slug } = await params` inside an `async` page component.
- `PageProps<'/c/[slug]'>`, `LayoutProps<'/dashboard'>` and `RouteContext<'/…'>` are
  **globally available generated helpers — do not import them.** The existing
  `apps/web/src/app/layout.tsx` already uses `LayoutProps<"/">`; follow that pattern
  everywhere rather than `React.PropsWithChildren`.
- Route groups `(marketing)` / `(auth)` / `(app)` are omitted from the URL and each carries
  its own `layout.tsx` nested inside the single root layout.
- `/cards/new` and `/cards/[cardId]` coexist: static segments take precedence over dynamic
  ones. A card whose id is literally `new` is therefore unreachable; fixture ids are
  prefixed (`card_…`) so this cannot occur. Asserted by AC-05.

### 6.2 Design-token contract

Every token in §8.2–§8.8 is a CSS custom property declared **once**, in
`apps/web/src/styles/tokens.css`, and re-exported to Tailwind v4 through a single
`@theme inline` block in `apps/web/src/styles/globals.css`.

```
tokens.css                       the ONLY file in the repo permitted to contain a raw
                                 colour literal (#hex, rgb(), hsl(), oklch())
globals.css                      @import "tailwindcss"; + @theme inline { … } + base layer
```

`apps/web/src/lib/tokens.ts` exports the same values as a typed frozen object so tests can
sweep them without parsing CSS:

```ts
export const TOKENS: {
  readonly surfaces: Readonly<Record<SurfaceToken, string>>;
  readonly inks:     Readonly<Record<InkToken, string>>;
  readonly rules:    Readonly<Record<RuleToken, string>>;
  readonly accents:  Readonly<Record<AccentToken, string>>;
  readonly signals:  Readonly<Record<SignalToken, string>>;
};
```

**Contract:** `tokens.ts` and `tokens.css` must not drift. A contract test parses
`tokens.css` and asserts the two sets are key-for-key and value-for-value identical (AC-12).

### 6.3 Fixture gateway — the only data source, and the state switch

`apps/web/src/lib/fixture-gateway.ts`

```ts
export type ScreenState = 'success' | 'loading' | 'empty' | 'error' | 'offline';

export interface FixtureResult<T> {
  state: ScreenState;
  data: T | null;
  error: FixtureError | null;
}

export interface FixtureError {
  kind: 'network' | 'not-found' | 'forbidden' | 'unknown';
  title: string;        // human, sentence case, no jargon, no error codes
  detail: string;       // one sentence explaining what the user can do
  retryable: boolean;
}

export function useFixture<T>(select: (db: FixtureDb) => T): FixtureResult<T>;
```

**How the four state families are reached — this is load-bearing.** Because there is no API,
loading/error/offline states would be unreachable and therefore untestable. They are made
reachable by a URL switch read by `useFixture`:

| URL | `state` | Behaviour |
|---|---|---|
| `/cards` | `success` | fixture data returned synchronously |
| `/cards?state=loading` | `loading` | `data: null`, screen renders its skeleton, never resolves |
| `/cards?state=empty` | `empty` | `data` is the empty collection |
| `/cards?state=error` | `error` | `error.kind='unknown'`, `retryable: true` |
| `/cards?state=offline` | `offline` | `error.kind='network'`, `retryable: true` |

Rules:
- `?state=` is read via `useSearchParams()` inside a client component wrapped in `<Suspense>`
  (required in App Router). It defaults to `success` and **any unrecognised value falls back
  to `success`** — it never throws (§11 E-34).
- The switch is available in production builds too. It is a review tool for Vansh, not a dev
  affordance, and it is how every a11y and edge test reaches these screens.
- `useFixture` returns synchronously. **No timers, no artificial latency, no promises.** A
  fake delay would make every test flaky for zero benefit.

### 6.4 `resolveCard` — the single source of truth for preview *and* payload

`apps/web/src/card/resolve-card.ts`

```ts
export interface ResolvedCard {
  cardId: string;
  slug: string;
  cardName: string;
  cardType: CardType;
  template: CardTemplate;
  fullName: string;
  avatar: ResolvedAvatar;
  bio: string | null;
  fields: ResolvedField[];        // ordered; see ordering rule below
  socialFields: ResolvedField[];  // SOCIAL_LINK only, split out for the social row
  qrPayload: string;              // `${SITE_URL}/c/${slug}` — see §8A.7
  droppedFieldIds: string[];      // ids in card.fieldIds absent from the profile (I-2)
  fieldCount: number;             // fields.length + socialFields.length
}

export function resolveCard(
  card: ContactCard, user: User, groups: FieldGroup[], fields: ProfileField[]
): ResolvedCard;
```

**Ordering rule** (deterministic, so snapshots and vCards are stable): fields sort by
`FieldCategory` in declaration order (`IDENTITY, PERSONAL, WORK, BUSINESS, SOCIAL, FINANCIAL,
CUSTOM`), then by `FieldType` in declaration order, then by `label` with
`localeCompare('en-GB')`, then by `id`.

**The architectural rule this exists to enforce (invariant I-5):**

> `<CardRenderer resolved={r} />`, `buildVcf(r)` and `exportCardPng(r)` all take **the same
> `ResolvedCard` reference**. The share panel must not re-derive. This is a structural fix for
> the old build's bug where the previewed file differed from the sent file — it is not a
> convention, it is enforced by there being no other way to construct the payload.

### 6.5 `<CardRenderer>` contract

`apps/web/src/card/card-renderer.tsx`

```ts
export type RenderMode = 'full' | 'thumb' | 'export';

export interface CardRendererProps {
  resolved: ResolvedCard;
  mode: RenderMode;
  className?: string;
}
```

| `mode` | Used by | Canvas | QR | Tested by |
|---|---|---|---|---|
| `full` | `/c/[slug]`, `/cards/[cardId]`, builder preview | `400 × 860` design px, fluid down to `336 × 722` | **functional**, ≥ 140px, all of §8A applies | every §8A test |
| `thumb` | `/templates` grid, `/cards` tiles, dashboard | design canvas `transform: scale(s)`, `s ∈ [0.24, 0.5]` | **non-functional placeholder glyph**, `aria-hidden`, `data-qr-mode="thumb"`, carries **no** encoded payload | asserted to be *excluded* from decode tests |
| `export` | PNG export | offscreen `400 × 860` at `pixelRatio: 2` → `800 × 1720` | **functional**, ≥ 280 device px | decode-after-export test |

**Why `thumb` must be excluded, explicitly:** a thumbnail is `transform: scale()`-ed, which
scales the QR below the 140px floor. A scanner cannot read a 40px QR, so rendering a real one
there would be a lie. The thumbnail renders a decorative glyph instead. **A tester who fails
the gallery for an unscannable QR has misread this spec** — AC-09 asserts the opposite.

Contract requirements:
- The card root carries `data-card-root`, `data-template-id`, `data-render-mode`.
- In `full`/`export` the subtree contains **exactly one** `[data-qr-zone]` (I-3).
- The renderer, not the template, computes the QR zone box (§8A.4).
- No `position: fixed` anywhere inside the card root — it breaks `export`.

### 6.6 Field renderer registry

`apps/web/src/card/field-renderers.tsx`

```ts
export const FIELD_RENDERERS: Record<FieldType, FieldRenderer>;
```

Typed as `Record<FieldType, …>`, so **omitting any of the 21 field types is a compile error**
(AC-21). Each renderer returns `{ icon, label, display, href | null }`.

| `FieldType` | `display` | `href` |
|---|---|---|
| `PHONE`, `LANDLINE`, `FAX` | E.164 formatted for display | `tel:` |
| `EMAIL` | as entered, lowercased | `mailto:` |
| `URL` | hostname + path, protocol stripped, clamped to 34 chars | the raw URL |
| `SOCIAL_LINK` | platform name derived from hostname; `@handle` when parseable | the raw URL |
| `ADDRESS` | `AddressDetail` composed to 1–2 lines | maps deep link |
| `PHOTO` | consumed by the avatar slot, never rendered as a row | `null` |
| `DATE` | `en-GB` long date | `null` |
| `JOB_TITLE`, `COMPANY`, `DEPARTMENT`, `TEXT`, `RELATION`, `STATUS`, `REG_NUMBER`, `CUSTOM` | verbatim, clamped | `null` |
| `LOCATION_TRACKING` | a status chip, never a coordinate | `null` |
| `BANK_ACCOUNT`, `DIGITAL_WALLET`, `CRYPTO_WALLET` | **masked by default**: last 4 shown, rest `••••` | `null` |

**Security rule:** the three financial types and any field with `isSensitive: true` render
masked on a public card, always, with no reveal control on `/c/[slug]` (§7.3).

### 6.7 vCard builder contract

`apps/web/src/card/build-vcf.ts` — `export function buildVcf(r: ResolvedCard): string;`

vCard 3.0, CRLF line endings, `CHARSET=UTF-8`. Concrete output for the fixture card
`card_ledger_demo` (name "Priyanka Raghunathan", 5 mapped fields):

```
BEGIN:VCARD
VERSION:3.0
N:Raghunathan;Priyanka;;;
FN:Priyanka Raghunathan
TITLE:Head of Partnerships
ORG:Fernwood Studio
TEL;TYPE=CELL:+919820115577
EMAIL;TYPE=INTERNET:priyanka@fernwood.example
URL:https://fernwood.example
NOTE:Saved from Contact Book — https://localhost:3000/c/prya-hq
END:VCARD
```

Error / degenerate shapes — these are contract tests, not hypotheticals:

| Input | Output | Rule |
|---|---|---|
| `fields.length === 0` | `buildVcf` **throws `EmptyCardError`** | see §11 E-01; the caller must never reach it because the UI blocks the action |
| a field value is `''` | that property is **omitted**, not emitted empty | no `TEL;TYPE=CELL:` with a blank value |
| value contains `,` `;` `\` | escaped per RFC 2426 | asserted for all three |
| a line exceeds 75 octets | folded with CRLF + single space | asserted with a 200-char `NOTE` |
| `isSensitive` field mapped | included, but financial values **masked** | matches what the card displays |

**Contract invariant (AC-22):** the set of `FieldType`s present in the `.vcf` is exactly the
set rendered visibly on the card. Preview and payload are the same object (I-5), so this is
provable, not aspirational.

### 6.8 PNG export contract

`apps/web/src/card/export-card-png.ts`

```ts
export async function exportCardPng(
  r: ResolvedCard, opts?: { pixelRatio?: 2 | 3 }
): Promise<Blob>;
```

- Renders `<CardRenderer mode="export">` into an offscreen node at `400 × 860`, rasterises at
  `pixelRatio` (default `2` → `800 × 1720`), returns a `image/png` `Blob`.
- Filename: `contact-book-{slug}.png`.
- **Constraint that shapes the design system:** `html-to-image` does not reliably rasterise
  `backdrop-filter`. §8A.3 therefore forbids `backdrop-filter` inside the card root outright —
  a translucent blurred QR scrim would look correct on screen and vanish in the export. This
  is why the QR plate is an opaque solid, not a frosted panel.
- Errors: rejects with `ExportFailedError { reason: 'font-not-loaded' | 'image-tainted' |
  'unknown' }`. The UI surfaces a retry and never leaves a spinner running (§11 E-44).

### 6.9 Public card action contracts

| Action | Contract | Failure |
|---|---|---|
| **Save to contacts** (primary) | `buildVcf(r)` → `Blob(['…'], {type:'text/vcard;charset=utf-8'})` → object URL → anchor with `download="{fullName}.vcf"` → revoke after 30s | if `fields.length === 0` the button is not rendered at all (§11 E-02) |
| **Message on WhatsApp** (secondary) | `https://wa.me/{e164 without +}` , `target="_blank" rel="noopener noreferrer"` | if no `PHONE` field is mapped, the button is **not rendered** — never rendered-and-disabled (§11 E-56) |

**Action budget: exactly two.** See §8A.2 — the QR zone claims the vertical space Linktree
gives to its third and fourth buttons.

### 6.10 Error surface shapes (what the user actually sees)

`error.tsx` boundaries receive `{ error: Error & { digest?: string }, reset: () => void }`.
Rendered shape, identical across all boundaries:

```
[ hairline-framed panel, --surface, no shadow, max-width 480px, centred ]
  overline   "SOMETHING WENT WRONG"
  display-3  <FixtureError.title>          e.g. "We couldn't load your cards"
  body       <FixtureError.detail>         e.g. "The connection dropped. Try again."
  button     "Try again"  -> reset()       (only when retryable)
  link       "Go to dashboard"  /  "Go home" on public routes
  caption    <digest>  — rendered only when present, muted, selectable
```

No stack traces, no raw error messages, no error codes as headlines.

---
## 7. Auth, Permissions, Security

### 7.1 Auth mechanism

**There is none in this run**, and that is deliberate (§3.1). The six auth screens are UI:
they validate input format client-side, animate between steps, and navigate. No OTP is sent,
no token is issued, no session is created, no route is guarded.

`[ASSUMED]` — a signed-in state is simulated by a single client-side context
(`FixtureAuthProvider`) seeded to "signed in as the fixture user" so `(app)` routes render.
It is **not** a security boundary and it is annotated as such in the source. When the real
API arrives, this provider is the single file that gets replaced.

### 7.2 Role → permission matrix

| | `/`, `/templates` | `(auth)` | `(app)` | `/c/[slug]` |
|---|---|---|---|---|
| Visitor | ✓ | ✓ | renders with fixture user `[ASSUMED]`, no guard | ✓ |
| Owner | ✓ | ✓ | ✓ | ✓ |
| Scanner | ✓ | ✓ | — (never navigated to) | ✓ |

### 7.3 PII handling — the part that is real even in a UI-only run

Public card pages are unauthenticated by design: anyone with the URL sees the card. That makes
these rules load-bearing now, not later.

- **Only mapped fields render.** A `ProfileField` not in `ContactCard.fieldIds` never reaches
  `ResolvedCard` and therefore cannot leak through a template, a `.vcf` or a PNG (I-6).
- **Financial types are masked**, always, on public surfaces: `BANK_ACCOUNT`,
  `DIGITAL_WALLET`, `CRYPTO_WALLET` → last 4 characters, remainder `••••`. There is **no
  reveal control on `/c/[slug]`**. Reveal exists only in `/profile`, behind an explicit
  per-field toggle that resets on navigation.
- **`LOCATION_TRACKING` never renders a coordinate** on any surface — only a status chip.
- **No PII in the URL.** `slug` is an opaque short id, never a name or a phone number.
- **No PII in `console`**, ever, including inside `error.tsx` (§13.2).
- **`rel="noopener noreferrer"`** on every `target="_blank"` link, including the WhatsApp
  action and every rendered `URL`/`SOCIAL_LINK` field. Enforced by lint (AC-32).
- **No `dangerouslySetInnerHTML` anywhere.** Fixture strings are rendered as text. Enforced by
  lint (AC-32). This is the entire XSS surface of a fixture-driven app, and it is closed.

### 7.4 Threat surface (this run) and mitigation

| Threat | Present? | Mitigation |
|---|---|---|
| XSS via user content | yes, structurally | no `dangerouslySetInnerHTML`; no `eval`; React escaping only |
| Reverse-tabnabbing | yes | `rel="noopener noreferrer"` enforced by lint |
| Tainted-canvas export leak | yes | export only rasterises same-origin `/public` images; remote portraits are proxied via `next/image` and the export path uses a same-origin copy |
| Over-broad field exposure | yes | I-6 + masking above |
| Secret leakage | no | there are no secrets; `NEXT_PUBLIC_SITE_URL` is the only env var and it is public by definition |
| CSRF / SSRF / injection | no | no mutations, no server-side requests, no database |

---

## 8. Technical Approach

### 8.1 Stack, versions, and what is being followed

Verified by reading the repo, not assumed:

| | Version | Source |
|---|---|---|
| Next.js | `16.3.1` | `apps/web/package.json` |
| React / React DOM | `19.2.8` | `apps/web/package.json` |
| Tailwind CSS | `^4` via `@tailwindcss/postcss` | `apps/web/package.json`, `postcss.config.mjs` |
| TypeScript | `^5`, `strict: true`, `moduleResolution: "bundler"`, path alias `@/*` | `apps/web/tsconfig.json` |
| ESLint | `^9` flat config, `eslint-config-next/core-web-vitals` + `/typescript` | `apps/web/eslint.config.mjs` |
| Package manager | `pnpm@11.13.1`, workspace `apps/*` + `packages/*` | `pnpm-workspace.yaml` |

**Existing patterns to follow (cite, don't reinvent):**

- `apps/web/src/app/layout.tsx` already uses `LayoutProps<"/">` and applies fonts via
  `next/font/google` with the CSS-variable method (`variable: '--font-…'` + `className` on
  `<html>`). **Keep that exact shape**; only the font choices and metadata change.
- `apps/web/src/app/globals.css` already uses Tailwind v4's CSS-first config
  (`@import "tailwindcss"` + `@theme inline`). **Keep that mechanism**; replace the contents.
  The `@media (prefers-color-scheme: dark)` block is **deleted** (NG4).
- `apps/web/next.config.ts` already sets `transpilePackages: ["@repo/types","@repo/utils"]`.
  Leave it; add options only if a Next 16 doc requires one.

**Next 16 warnings that cost time if ignored** (`apps/web/AGENTS.md` says this version differs
from training data; these were checked in `node_modules/next/dist/docs/`):
`params` is a Promise · `PageProps`/`LayoutProps`/`RouteContext` are global, never imported ·
`useSearchParams()` requires a `<Suspense>` boundary · `next/font` variable fonts need no
`weight`, and extra axes (`opsz`, `wdth`) are opted into via `axes: [...]`.

### 8.2 The design direction, and the alternatives rejected

**Chosen:** *warm paper + deep green, editorial, near-flat, hairline-ruled, 80/20.*

Ground is a warm off-white (`#F7F1E6`), ink is a near-black green-black, and there is exactly
**one** accent — deep green `#0E5F4F` — used across roughly 20% of coloured pixels. Structure
comes from type scale, hairline rules and whitespace, not from cards-on-cards or shadows.

Why, and what was rejected:

| Alternative | Rejected because |
|---|---|
| Copy Hinge's palette (white / black / Kohlrabi purple) | legally and visually derivative; Q4 says borrow the *system*, not the skin |
| Keep the old build's neutral-grey + teal `--public-*` pair | it is the documented failure: two parallel palettes fighting each other (findings §D) |
| Neutral grey ground | grey + a green accent reads as generic SaaS; warm paper is the single cheapest thing that makes this not look AI-made |
| Dark mode as well | Q23: warm paper inverts badly, and it makes QR plate contrast unpredictable across templates |
| shadcn/ui defaults | Q29: the shadcn look is part of the AI fingerprint. Radix primitives for *behaviour*, 100% of the visual layer written against our tokens |

### 8.3 Colour tokens — every value, every role, every measured ratio

Declared once in `apps/web/src/styles/tokens.css`. All ratios below were **computed**, not
estimated, and are reproduced by the automated sweep in AC-13.

**Surfaces — the 80%**

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#F7F1E6` | page ground, everywhere |
| `--paper-sunk` | `#EFE6D6` | sidebar, wells, table zebra, recessed panels |
| `--surface` | `#FFFCF6` | cards, panels, list rows, inputs |
| `--surface-raised` | `#FFFFFF` | dialogs, popovers, toasts, **the QR plate** |

**Ink**

| Token | Hex | Role | vs `paper` | vs `paper-sunk` | vs `surface` | vs `surface-raised` |
|---|---|---|---|---|---|---|
| `--ink` | `#14211C` | headings, body, primary text | **14.78** | **13.42** | **16.22** | **16.61** |
| `--ink-muted` | `#55655D` | secondary text, labels, captions | **5.48** | **4.98** | **6.02** | **6.17** |
| `--ink-faint` | `#7C8B83` | **disabled + decorative only** | 3.18 | 2.89 | 3.50 | 3.58 |
| `--ink-inverse` | `#FFFCF6` | text on accent fill | — | — | — | — |

> **The salvaged palette had a real bug and this spec fixes it.** The old
> `theme-preview-page.tsx` used `#65756D` as its muted ink: **4.33:1 on `--paper` and 3.93:1
> on `--paper-sunk`** — it fails AA for body text on the two most common grounds in the app.
> `--ink-muted` is therefore re-derived to `#55655D`, which clears 4.5:1 on all four surfaces.
> `#7C8B83` (`--ink-faint`) is kept **only** for disabled states and decorative marks and is
> **forbidden for any body text** — AC-13 fails the build if it is used as a text colour.

**Accent — the 20%**

| Token | Hex | Role | Measured |
|---|---|---|---|
| `--accent` | `#0E5F4F` | primary buttons, active nav, links, focus emphasis | 6.75 on `paper`; `--ink-inverse` on it ≈ **7.4** |
| `--accent-hover` | `#0A4B3F` | hover/press of the above | 8.93 on `paper`; white on it **10.04** |
| `--accent-wash` | `#DDF4E8` | active nav pill, selected row, success chip | `--accent` on it **6.57**; `--ink` on it **14.38** |
| `--accent-ink` | `#FFFCF6` | text/icon on any accent fill | — |

**Rules**

| Token | Hex | Role | Measured |
|---|---|---|---|
| `--rule` | `#D8CCB9` | decorative 1px hairline separators | 1.41 on `paper` — decorative, exempt from 1.4.11 |
| `--rule-control` | `#8F7F66` | **input / control boundaries** | **3.46** on `paper`, **3.14** on `paper-sunk` — clears the 3:1 non-text bar |

**Signals — rare by design**

| Token | Hex | Role | Measured |
|---|---|---|---|
| `--danger` | `#8A3B28` | destructive text, destructive fill | 6.83 on `paper`; white on it **7.67** |
| `--danger-wash` | `#FBE4DE` | destructive chip / inline warning ground | `--danger` on it **6.30** |
| `--warning-ink` | `#6B4A08` | warning text (incl. the empty-card warning) | **7.16** on `paper` |
| `--warning-wash` | `#FBEBC8` | warning chip ground | `--warning-ink` on it **6.83** |
| `--success` | = `--accent` | success text/chip — deep green already reads success | 6.75 on `paper` |
| `--clay` | `#D96C55` | **decorative fill only** (template art) | 3.00 on `paper` — **never text, never a control boundary** |
| `--amber` | `#E8B44F` | **decorative fill only** | 1.69 on `paper`; `--ink` on it **8.76** |

**Focus**

| Token | Value | Role |
|---|---|---|
| `--focus-ring` | `--ink` `#14211C` | 2px outer ring |
| `--focus-offset` | `--surface-raised` `#FFFFFF` | 2px inner offset ring |

> **Why two rings.** A single dark ring is invisible on the accent fill
> (`--ink` vs `--accent` = 2.19:1, under the 3:1 bar). A single light ring is invisible on
> paper. The `ink → white → any ground` sandwich clears 3:1 on **every** surface in the system
> including accent fills and photographic template backgrounds. Implemented once:
> `outline: 2px solid var(--focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--focus-offset);`
> in a single `:focus-visible` base rule. No component reimplements it.

**The 80/20 discipline (Hinge's rule, our colours), stated as an enforceable target:**
on any full-page screenshot of an `(app)` or `(marketing)` route, pixels belonging to the
paper/ink families must be **≥ 78%** and accent + signal families **≤ 22%**. Measured by
sampling the Playwright screenshot (AC-16). This is what stops "primary green everywhere",
which is the single fastest way to make a warm palette look cheap.

### 8.4 Typography

**Families — both Google Fonts, both variable, both confirmed present in this exact Next
build's `next/font/google` data:**

| Role | Family | Axes available (verified) | Replaces |
|---|---|---|---|
| Display / editorial serif | **Newsreader** | `opsz 6–72`, `wght 200–800`, normal + italic | Tiempos Headline |
| UI / body sans | **Hanken Grotesk** | `wght 100–900`, normal + italic | Modern Era |

Loaded in `apps/web/src/app/layout.tsx` with the CSS-variable method already used by the
scaffold:

```ts
const newsreader = Newsreader({
  subsets: ['latin'], axes: ['opsz'], display: 'swap',
  variable: '--font-display', fallback: ['Georgia', 'serif'],
});
const hanken = Hanken_Grotesk({
  subsets: ['latin'], display: 'swap',
  variable: '--font-ui', fallback: ['system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial'],
});
```

`adjustFontFallback` stays at its default `true` so CLS from font swap is ~0 (AC-17).

**⚠ The weight tension, stated openly rather than buried.**

Q17 chose a **one-weight editorial system** because the supplied TTFs shipped only Regular 400.
Q18 then replaced those TTFs with free variable analogues, which makes every weight available
again — dissolving the original *reason* for the rule. Then the reference analysis showed
**Boultont's name is "noticeably bolder"** and **Lane uses a completely different display
family**, proving real templates need weight and family freedom.

Resolution — a **two-domain weight policy**. It is not a compromise for its own sake; the two
domains have genuinely different jobs:

| Domain | Families | Allowed weights | Rationale |
|---|---|---|---|
| **Product UI** — app, auth, marketing, gallery chrome | Newsreader + Hanken Grotesk **only** | Newsreader: **400 only**. Hanken: **400 and 500 only**. **600+ forbidden.** | Q17's discipline kept as an *aesthetic rule*: hierarchy from size, leading, tracking, colour and case. Single-weight editorial typesetting is one of the strongest signals a page was not machine-generated. |
| **Card templates** — inside `src/card/templates/**` only | the closed 4-family set below | declared per template by `typeFamily`; up to **700** | Lane and Boultont prove typeface and weight are per-template variables. A template system whose templates all look the same is not a template system. |

**The closed template type-family set** (no template may introduce a fifth):

| `typeFamily` | Google Font | Verified axes | Reference it serves |
|---|---|---|---|
| `editorial-serif` | Newsreader | `opsz`, `wght` | house default |
| `friendly-grotesk` | Hanken Grotesk | `wght` | Artemis, Balcombe, Smythe |
| `condensed-bold` | **Archivo** | `wdth 62–125`, `wght 100–900` | Boultont |
| `wide-display` | **Bricolage Grotesque** | `opsz 12–96`, `wdth 75–100`, `wght 200–800` | Lane |

The two card-only families are loaded **only in the `(app)` card routes and `/c/[slug]`**, not
in the root layout, so the marketing and auth bundles never pay for them (AC-17).

**Enforcement (greppable, therefore real):** no `font-bold` / `font-semibold` /
`font-extrabold` / `font-black` Tailwind utility and no `font-weight` above `500` may appear
anywhere under `apps/web/src/` **except** `apps/web/src/card/templates/**`. AC-15.

**The type scale — every step, with its exact role.** Display steps are Newsreader,
UI steps are Hanken Grotesk. `tracking` is in `em`.

| Token | Size | Line-height | Tracking | Weight | `opsz` | Role |
|---|---|---|---|---|---|---|
| `--type-display-hero` | 72px / 4.5rem | 1.02 (73px) | −0.022 | 400 | 72 | marketing hero headline — **used once per site** |
| `--type-display-1` | 56px / 3.5rem | 1.06 (59px) | −0.020 | 400 | 48 | marketing section headline |
| `--type-display-2` | 40px / 2.5rem | 1.10 (44px) | −0.016 | 400 | 36 | auth question headline; sub-section headline |
| `--type-display-3` | 30px / 1.875rem | 1.16 (35px) | −0.012 | 400 | 30 | app page title; owner name on a `full` card |
| `--type-display-quote` | 22px / 1.375rem | 1.45 (32px) | −0.004 | 400 *italic* | 22 | pull-quote, testimonial |
| `--type-title-1` | 22px / 1.375rem | 1.27 (28px) | −0.010 | 500 | — | app section heading, dialog title |
| `--type-title-2` | 18px / 1.125rem | 1.33 (24px) | −0.008 | 500 | — | list-item title, card tile name |
| `--type-body-lg` | 17px / 1.0625rem | 1.60 (27px) | 0 | 400 | — | marketing paragraph, auth helper copy |
| `--type-body` | 15px / 0.9375rem | 1.60 (24px) | 0 | 400 | — | **default UI body** |
| `--type-body-sm` | 13px / 0.8125rem | 1.54 (20px) | +0.002 | 400 | — | helper text, field values, metadata |
| `--type-label` | 13px / 0.8125rem | 1.23 (16px) | +0.010 | 500 | — | form labels, button labels |
| `--type-caption` | 12px / 0.75rem | 1.33 (16px) | +0.010 | 400 | — | captions, timestamps, counts |
| `--type-overline` | 11px / 0.6875rem | 1.45 (16px) | **+0.140** | 500 | — | eyebrow labels, **UPPERCASE** — e.g. "BROWSE BY CATEGORY" |
| `--type-numeric` | 13px / 0.8125rem | 1.54 (20px) | 0 | 400 | — | table numerics, `font-variant-numeric: tabular-nums` |

**Responsive display steps** (the only steps that change; UI steps are fixed at all widths):

| Token | ≥ 1024px | 768–1023px | ≤ 767px |
|---|---|---|---|
| `--type-display-hero` | 72px | 56px | **40px**, lh 1.06, tracking −0.018 |
| `--type-display-1` | 56px | 44px | **34px**, lh 1.10, tracking −0.016 |
| `--type-display-2` | 40px | 34px | **28px**, lh 1.14, tracking −0.012 |
| `--type-display-3` | 30px | 28px | **24px**, lh 1.20, tracking −0.010 |

Implemented with `clamp()` against these exact endpoints, not with a Tailwind breakpoint
ladder, so there are no jumps between the named widths.

**Typographic rules that carry the "editorial, not generated" quality:**
- Body copy is **never** centred below 3 lines except in `(auth)` and the marketing hero.
- Measure is capped at **68 characters** (`max-width: 34em` on `--type-body-lg`).
- Never letter-space lowercase text. Positive tracking is reserved for `--type-overline` and
  `--type-label`.
- Never mix `--type-display-*` and `--type-title-*` in the same heading block.
- Hyphenation off; `text-wrap: balance` on display steps, `text-wrap: pretty` on body.

### 8.5 Spacing scale

4px base, extended from the old build's salvaged scale.

| Token | px | Primary use |
|---|---|---|
| `--space-1` | 4 | icon↔label gap, chip inset |
| `--space-2` | 8 | tight stack, input inner padding-y |
| `--space-3` | 12 | control inner padding-x, **card button stack gap** |
| `--space-4` | 16 | default element gap, list row padding |
| `--space-5` | 20 | card inner padding (mobile) |
| `--space-6` | 24 | card inner padding (desktop), form field gap |
| `--space-8` | 32 | block gap, panel padding |
| `--space-10` | 40 | **gallery grid gutter** (matches the reference), section inner gap |
| `--space-12` | 48 | major block separation |
| `--space-16` | 64 | app page top padding |
| `--space-20` | 80 | marketing section padding-y (mobile) |
| `--space-24` | 96 | marketing section padding-y (tablet) |
| `--space-32` | 128 | marketing section padding-y (desktop) |

Layout constants: `--sidebar-width: 240px` (Q30, matches the old build) ·
`--sidebar-collapsed: 68px` · `--content-max: 1200px` · `--prose-max: 34em` ·
`--card-design-w: 400px` · `--card-design-h: 860px` · `--bottombar-height: 64px`.

**Rule:** vertical rhythm is a multiple of 4 everywhere. Any value not on this scale is a bug.

### 8.6 Radius scale and where each is allowed

| Token | px | Allowed on | Forbidden on |
|---|---|---|---|
| `--radius-xs` | 4 | **the QR plate** (larger radii eat the quiet zone at the corners), inline code, small chips | anything full-bleed |
| `--radius-sm` | 8 | inputs, selects, small buttons, table cells | card frames |
| `--radius-md` | 12 | buttons, dropdown items, **`rounded-rect` card buttons** (Smythe) | — |
| `--radius-lg` | 16 | panels, dialogs, list-row hover fills | — |
| `--radius-xl` | 20 | **card frame + gallery template frame** (reference measured ~16–20px) | — |
| `--radius-2xl` | 28 | mobile bottom sheet only | **everything else** |
| `--radius-full` | 9999 | avatars, category-rail pills, status chips, **`pill` card buttons** | panels, cards, images |

**Anti-AI rule (§8C):** `rounded-2xl` and `rounded-3xl` may not appear outside the mobile
sheet component. "Everything is `rounded-2xl`" is one of the loudest generated-UI tells.

### 8.7 The hairline-rule system, and the elevation policy

**Hairlines are the primary separation device.** Not shadows, not nested cards.

| Token | Value | Use |
|---|---|---|
| `--hairline` | `1px solid var(--rule)` | list-row separators, section dividers, table lines |
| `--hairline-strong` | `1px solid var(--rule-control)` | input, select and secondary-button boundaries (needs 3:1) |
| `--hairline-inset` | `1px solid var(--rule)` inset 12px | decorative framing (the *Passage* template) |

Always a real `border`, never a `box-shadow` fake — box-shadow hairlines do not survive PNG
export. Always `1px`, never `0.5px`: sub-pixel hairlines disappear on non-integer DPRs.

**Elevation policy — decided, with the reason, because the old build got this exactly wrong.**

The previous system declared `--shadow-soft` and `--elevation-*` and then set every one of
them to `none`. The tokens existed and lied. This system takes the opposite approach: **three
levels, all real, all narrowly scoped.**

| Token | Value | Permitted on |
|---|---|---|
| `--elevation-0` | `none` | **every element in normal document flow** — cards, list rows, panels, sections, template frames, the card itself |
| `--elevation-1` | `0 1px 2px rgba(20,33,28,.06), 0 8px 24px -12px rgba(20,33,28,.14)` | popover, dropdown, select menu, tooltip, toast |
| `--elevation-2` | `0 2px 4px rgba(20,33,28,.08), 0 24px 56px -20px rgba(20,33,28,.22)` | dialog, mobile sheet, drag-lifted item |

**The rule, in one line:** *if it is in normal flow it gets `--elevation-0`; only something
that is genuinely floating above the page — portalled, fixed or absolutely positioned over
other content — may use `--elevation-1` or `--elevation-2`.*

Why this way rather than "flat everywhere": the anti-AI list forbids *drop shadows on every
surface*, and it is right — but a modal with no shadow is a usability failure, not restraint.
Scoping elevation to overlays satisfies both. Enforced by lint: no `shadow-*` utility and no
`box-shadow` outside `apps/web/src/components/overlay/**` (AC-15).

**One sanctioned exception:** `buttonShadow: 'soft'` on a card template (the Balcombe
floating-white-pill look) resolves to `--elevation-1` **inside the card root only**. It is
declared in the template schema, so it is data, not a stray utility class.

### 8.8 Iconography

- **Library: `lucide-react`.** The anti-AI list bans *a lucide icon in a rounded-square tinted
  chip*, which is a **layout** pattern, not the library. Lucide is allowed; that chip is not.
- Line icons, **1.5px stroke** at 24px, `stroke="currentColor"`, round caps and joins.
- **Exactly three sizes: 16 / 20 / 24.** 16 pairs with `body-sm` and `label`; 20 with buttons
  and list rows; 24 with nav and page headers. No other size may appear.
- Icons inherit `--ink-muted` by default and take `--accent` **only** on the active nav item
  and on a success confirmation. Icons are never `--clay` or `--amber`.
- **Every icon-only control has an `aria-label`.** Every decorative icon has `aria-hidden="true"`.
  No meaning is ever carried by an icon alone (AC-25).
- **The marketing page uses no icons at all** above the footer. Steps are numbered `01 / 02 / 03`
  in `--type-overline` — Hinge's device, and the direct antidote to the icon-chip grid.
- Social glyphs on cards are monochrome, 24px, inheriting the template's `textOnMedia` colour
  (reference: all six templates do exactly this).

### 8.9 Motion tokens

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | `90ms` | hover / press feedback |
| `--dur-fast` | `160ms` | control state, toggle, tab underline, chip select |
| `--dur-base` | `240ms` | popover / dropdown / toast, template swap in the builder |
| `--dur-slow` | `420ms` | dialog, mobile sheet, auth step transition |
| `--dur-editorial` | `700ms` | marketing scroll-driven reveals **only** |
| `--ease-standard` | `cubic-bezier(.2,0,0,1)` | default |
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | entrances |
| `--ease-in` | `cubic-bezier(.7,0,.84,0)` | exits |
| `--ease-lift` | `cubic-bezier(.34,1.24,.64,1)` | **two places only**: the "Saved to contacts" tick and the template-selected tick |

Policy (Q32): **editorial motion on marketing, calm in-app.** Two — and only two — scroll-driven
moments on the marketing page: the template showcase and the QR/scan demo. No scroll-jacking:
the page never intercepts wheel or touch scroll; scroll-linked effects use CSS
`animation-timeline: view()` with an `IntersectionObserver` fallback.

**`prefers-reduced-motion: reduce` is implemented once, centrally, by overriding the duration
tokens** — so no component has to remember, and there is exactly one place to test:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-instant: 0ms; --dur-fast: 0ms; --dur-base: 0ms;
    --dur-slow: 0ms;    --dur-editorial: 0ms;
  }
  /* opacity-only fades survive, capped */
  *, *::before, *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important;
  }
}
```

Under reduced motion: scroll-driven sections render at their **end state immediately**; no
transform, no parallax; nothing auto-plays; the skeleton shimmer becomes a static tint (AC-27).

---
## §8A — THE QR CONTRACT (normative, and the most important section in this document)

Vansh, verbatim: *"Just make sure each and every card that I am sharing with you explicitly has
a QR code in it. Make sure you are making the design according to that itself. Each and every
QR card should have a QR."*

A QR code is a **functional optical target**. It is the only element in this design system that
can be *objectively wrong*. A template that decorates over it, tints it, shrinks it, or places
it on a photograph has not made a stylistic choice — it has shipped a card that does not work.
Everything in this section is a MUST, and every clause has a test.

### §8A.1 Why the references do not help here

**None of the six supplied reference templates contains a QR code.** Artemis, Balcombe,
Boultont, Lane and Smythe Sports all spend their entire vertical budget on a stack of 3–4 link
buttons plus a social row. They are link pages. Contact Book's card is not a link page — its
payload *is* the QR.

Worse, four of the six backgrounds would destroy a bare QR outright:

| Reference | Background | Effect on a bare QR |
|---|---|---|
| **Artemis** | flat olive-sage upper zone | **friendliest** — a solid, mid-tone field; still needs a plate, but tolerant |
| Balcombe | full photo (aqua water / wooden deck) | destroys it — high local variance |
| Boultont | dark vignetted concrete | destroys it — dark modules vanish into dark ground |
| Smythe Sports | high-key cyan court with painted lines | destroys it — line work reads as false modules |
| **Lane** | high-chroma magenta→purple→blue mesh gradient | **most hostile** — chroma plus gradient defeats binarisation; **MUST use a fully opaque plate, never a translucent scrim** |

### §8A.2 ⚠ THE DELIBERATE DIVERGENCE, and its cost

> **The protected QR zone claims the vertical space that Linktree gives to two or three of its
> stacked buttons.** It sits **below name/bio and above the action row**.
>
> **Consequence, accepted deliberately: our card carries exactly TWO action buttons, not four.**
> Primary "Save to contacts", secondary "Message on WhatsApp", plus the field/social row.
> Vertical space is not free, and the QR zone claims it first.

Any executor or reviewer who looks at a reference template and asks "where are the other two
buttons?" has found the divergence, not a bug. AC-20 asserts the two-button budget.

Vertical budget at the `400 × 860` design canvas, and at the `336 × 722` minimum:

| Slot | Design (400×860) | Minimum (336×722) |
|---|---|---|
| top padding | 32 | 24 |
| avatar (80 / 72) + gap | 96 | 84 |
| name (`display-3`) + gap | 42 | 34 |
| bio, up to 3 lines + gap | 64 | 60 |
| **QR zone (plate + quiet zone + caption)** | **196** | **188** |
| action row — 2 buttons @ 52 + 12 gap + 16 | 132 | 132 |
| social / field row | 28 | 28 |
| bottom padding | 32 | 24 |
| **used** | **622 of 860** | **574 of 722** |
| **template art headroom** | **238px** | **148px** |

Both fit. The remaining headroom is what a template spends on its photo split, its framing, or
extra field rows. AC-35 asserts no vertical overflow at 360px.

### §8A.3 Reserved region geometry (MUST)

```
                 ┌─────────────────────────────────────┐
                 │  RESERVED REGION  (nothing else may  │
                 │  paint here, at any z-index)         │
                 │   ┌───────────────────────────────┐  │
                 │   │  PLATE  --surface-raised      │  │  ← opaque, solid, radius ≤ 4px
   quietZonePx → │   │   ┌───────────────────────┐   │  │
                 │   │   │                       │   │  │
                 │   │   │   QR SYMBOL  ≥140px   │   │  │  ← ECC H
                 │   │   │   modules #0B0B0B     │   │  │
                 │   │   │                       │   │  │
                 │   │   └───────────────────────┘   │  │
                 │   └───────────────────────────────┘  │
                 └─────────────────────────────────────┘
                        optional caption BELOW, outside the plate
```

| Property | Requirement | Rationale |
|---|---|---|
| **Symbol size** | `qrSizePx = max(140, min(0.42 × cardWidth, 200))` — **hard floor 140 CSS px**, hard ceiling 200 | 140px is the smallest reliable arm's-length scan off a phone screen |
| **Absolute, never scaled** | in `full` mode the symbol is an absolute pixel size; the card **does not** `transform: scale()` its content | scaling the card would scale the QR under the floor; layout uses container queries, not transform |
| **Quiet zone** | `quietZonePx = max(16, ceil(4 × qrSizePx / moduleCount))`, on **all four sides**, painted in the plate colour | 4 modules is the QR spec minimum; below it, scanners fail |
| **Reserved region** | `qrSizePx + 2 × quietZonePx`, square | |
| **Plate** | **solid, fully opaque** `--surface-raised` `#FFFFFF`. **No** gradient, **no** alpha < 1, **no** `backdrop-filter`, **no** background image | `backdrop-filter` does not rasterise in `html-to-image` — it would look right on screen and vanish in the export (§6.8) |
| **Plate radius** | `--radius-xs` = 4px **maximum** | larger radii clip the quiet zone at the corners |
| **Module colour** | `--qr-module` `#0B0B0B` on `--qr-plate` `#FFFFFF` | measured **19.68:1** |
| **Contrast floor** | **≥ 15:1** module-to-plate | far above WCAG; scanners binarise, and margin is cheap |
| **Never inverted** | light modules on a dark plate are **forbidden** | many scanner implementations reject inverted symbols |
| **ECC level** | **`H`** (≈30% recovery) | this is what legalises the centre mark |
| **Centre occlusion** | at most **one** centred mark, area ≤ **20%** of the symbol (side ≤ 0.447 × qrSize), on an opaque plate pad with **≥ 2 modules** clearance | 20% < the 30% budget, leaving headroom for screen glare and print wear |
| **Any other occlusion** | **forbidden** | |
| **Scrim variant** | if a template insists on placing the zone over media, the plate becomes a **hard-edged opaque** panel — never a blur, never translucent | Lane proves why |

### §8A.4 Who computes the geometry (MUST)

**The renderer computes the QR zone box. The template never does.**

`CardTemplate.qrZone` declares only an **anchor** from a closed enum:

```ts
type QrAnchor = 'below-identity' | 'card-center' | 'above-actions' | 'bottom-plate';
interface QrZoneSpec {
  anchor: QrAnchor;
  plate: 'solid';              // the only permitted value; the union exists to make the intent explicit
  caption: string | null;      // optional line rendered BELOW the plate, outside the reserved region
  decorate: 'none' | 'corner-marks' | 'rule-above' | 'rule-below';
}
```

`<QrZone>` reads the anchor, computes `qrSizePx`, `quietZonePx` and the reserved box from the
measured card width, and paints. A template can influence *where* the zone sits and what
decorates *around* it. It cannot influence the numbers.

**Layering (MUST):** `[data-qr-zone]` is the **last child** of the card root and carries
`isolation: isolate`. No sibling inside the card root may use a `z-index` that places it above
the zone. Template decoration renders strictly beneath.

**What a template MAY do around the zone:** hairline rules above or below, corner tick marks
outside the reserved region, a caption below the plate, and background art that terminates at
the reserved-region boundary. **What it may NEVER do:** paint anything inside the reserved
region, change the plate's opacity or colour, resize the symbol, or move the centre mark.

### §8A.5 `thumb` mode is explicitly exempt

In `thumb` mode the card **is** `transform: scale()`-ed (0.24–0.5), which would put the symbol
at 34–70px — unscannable. Rendering a real QR there would be a lie. Therefore:

- `thumb` renders a **decorative QR glyph**, `aria-hidden="true"`, `data-qr-mode="thumb"`,
  encoding **nothing**.
- The scannability suite **skips** `thumb` and instead **asserts** that no `thumb` render
  contains a decodable symbol (AC-09).
- A tester failing the gallery for an unscannable QR has misread this section.

### §8A.6 Payload

```
qrPayload = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/c/${slug}`
```

- `slug` ≤ **24 characters**, `[a-z0-9-]` only.
- **`qrPayload.length` ≤ 60 bytes**, enforced at fixture-build time and asserted (AC-08).
- 60 bytes at ECC H keeps the symbol at **version 6 (41×41) or below**. At the 140px floor that
  is **≥ 3.4 CSS px per module** — comfortably above the ~2px camera threshold.
- Encoding is **byte mode**, `errorCorrectionLevel: 'H'`, `margin: 0` (the quiet zone is drawn
  by `<QrZone>`, not by the encoder, so the plate owns it).
- Rendered as **inline SVG**, not canvas: SVG is crisp at any DPR and rasterises reliably in
  `html-to-image`.

### §8A.7 ⚙ HOW THIS IS MACHINE-VALIDATED — six tests, not six guidelines

This is the part that makes §8A a contract instead of a wish. Every clause above maps to an
assertion below. All six run for **every template × every supported viewport**.

| # | Test | Runner | Asserts |
|---|---|---|---|
| **QR-T1** | `qr-geometry.spec.ts` | Playwright, real layout | For each template at 360 / 768 / 1440: `boundingBox()` of `[data-qr-symbol]` has `width === height` and `width ≥ 140`; the plate's box exceeds the symbol's by `≥ 16px` on all four sides; plate `border-radius ≤ 4px` |
| **QR-T2** | `qr-plate.spec.ts` | Playwright + `getComputedStyle` | plate `background-color` alpha **=== 1**; `background-image === 'none'`; `backdrop-filter === 'none'`; computed module/plate contrast **≥ 15:1**; symbol is not inverted (plate luminance > module luminance) |
| **QR-T3** | `qr-overlap.spec.ts` | Playwright, real geometry | For every other element inside `[data-card-root]`, its `boundingBox()` **does not intersect** the reserved region. This is the test that catches "a theme decorated over the QR" — the failure §8A exists to prevent |
| **QR-T4** | `qr-occlusion.spec.ts` | Playwright DOM + geometry | `[data-qr-zone]` contains only the plate, the symbol and **at most one** `[data-qr-mark]`; if present, its area ≤ 20% of the symbol's area and its clearance ≥ 2 modules |
| **QR-T5** | **`qr-scannability.spec.ts`** | **Playwright screenshot → `jsqr` decode** | Screenshot `[data-qr-zone]` for each template at each viewport, decode the PNG, and assert **`decoded.data === resolved.qrPayload`, exactly**. **This is the ground-truth test.** If any template breaks the QR in any way this spec failed to anticipate, this test fails |
| **QR-T6** | `qr-export.spec.ts` | `exportCardPng()` → `jsqr` decode | The exported `800 × 1720` PNG decodes to the same payload. Guards the export path independently of the DOM path, because rasterisation is where silent QR failures hide |

**Additionally, at the type level:** `qrZone` is a **non-optional** property of `CardTemplate`
with no default. A template that omits it does not compile. A template author cannot forget the
QR — TypeScript will not let them (AC-07).

**Failure severity:** any QR-T1…QR-T6 failure is **P0**. It is never deferred, never
"quality/polish", and never fixed by relaxing the assertion. Vansh, Q27: cards and QR are never
cut.

---
## §8B — THE CARD TEMPLATE SYSTEM

Vansh, Q9: *"We just need to ship 6-8 templates but all those should be classy."*
Quality over quantity. Each template gets real art direction, not a palette swap.

### §8B.1 The universal skeleton (from the references, adapted for the QR)

Every template is the **same skeleton** with different art direction. The skeleton *is* the
system — that is the single most valuable thing the references taught.

```
┌─ card frame · 400×860 design px · aspect 1:2.15 · radius --radius-xl (20px) · overflow hidden ─┐
│  ▓▓ full-bleed BACKGROUND  (solid | photo | solid+photo-split | gradient-mesh)                 │
│                                                                                                │
│              ◯  AVATAR — circular, centred, 80px (72px at min width), 15–20% from top          │
│                        avatarKind: 'photo' → image (monogram fallback)                         │
│                        avatarKind: 'logo-mark' → filled accent circle + monogram   [Artemis]   │
│                                                                                                │
│                 NAME — centred, --type-display-3, tight leading, textOnMedia colour            │
│                 BIO  — centred, 1–3 lines, --type-body-sm, 80% opacity of textOnMedia          │
│                                                                                                │
│   ╔══════════════════════════════════════════════════════════════════════╗                     │
│   ║  PROTECTED QR ZONE  — §8A. Opaque plate. Nothing paints here.        ║  ◀── OUR DIVERGENCE │
│   ╚══════════════════════════════════════════════════════════════════════╝                     │
│                        optional caption, below the plate                                       │
│                                                                                                │
│   [        Save to contacts        ]   ← primary,  full width, 52px                            │
│   [      Message on WhatsApp       ]   ← secondary, full width, 52px    (EXACTLY TWO)          │
│                                                                                                │
│   FIELD ROW  — mapped non-social fields, compact                                               │
│   SOCIAL ROW — mapped SOCIAL_LINK glyphs, monochrome, 24px, centred                            │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Slot order is fixed across all templates. A template varies art direction, not anatomy.

### §8B.2 The `CardTemplate` schema — the reference taxonomy, encoded verbatim

`apps/web/src/card/template-types.ts`

```ts
export type TemplateId =
  | 'ledger' | 'chapter' | 'foundry' | 'marquee'
  | 'atrium' | 'almanac' | 'terminal' | 'passage';

export type TemplateCategory = 'business' | 'personal' | 'event' | 'creative';

/* ── the taxonomy extracted from Artemis / Balcombe / Boultont / Lane / Smythe ── */
export type TemplateBackground   = 'solid' | 'photo' | 'solid+photo-split' | 'gradient-mesh';
export type TemplateButtonFill   = 'tonal' | 'white' | 'solid-accent' | 'translucent-textured';
export type TemplateButtonRadius = 'pill' | 'rounded-rect';
export type TemplateButtonIcon   = 'none' | 'leading-emoji' | 'leading-platform-chip';
export type TemplateButtonShadow = 'none' | 'soft';
export type TemplateTextOnMedia  = 'light' | 'dark';
export type TemplateAvatarKind   = 'photo' | 'logo-mark';
export type TemplateTypeFamily   =
  | 'editorial-serif'   // Newsreader
  | 'friendly-grotesk'  // Hanken Grotesk
  | 'condensed-bold'    // Archivo (wdth axis)      [Boultont]
  | 'wide-display';     // Bricolage Grotesque      [Lane]

export interface TemplatePalette {
  ground:      string;  // token ref or hex, resolved from tokens.css
  groundAlt:   string | null;  // the second zone of a split background
  ink:         string;  // primary text on this template
  inkSoft:     string;  // bio / secondary text
  buttonBg:    string;
  buttonInk:   string;
  buttonBgAlt: string;  // secondary button
  buttonInkAlt:string;
  markFill:    string;  // logo-mark circle fill
}

export interface CardTemplate {
  id:           TemplateId;
  name:         string;        // product name, NEVER a number
  blurb:        string;        // one line, gallery caption + builder tooltip
  category:     TemplateCategory;

  background:   TemplateBackground;
  backgroundSrc: string | null;   // /public path; required iff background involves a photo
  palette:      TemplatePalette;

  buttonFill:   TemplateButtonFill;
  buttonRadius: TemplateButtonRadius;
  buttonIcon:   TemplateButtonIcon;
  buttonShadow: TemplateButtonShadow;

  textOnMedia:  TemplateTextOnMedia;
  avatarKind:   TemplateAvatarKind;
  typeFamily:   TemplateTypeFamily;

  qrZone:       QrZoneSpec;    // ⚠ NON-OPTIONAL, NO DEFAULT — see §8A.7
}

/* Exhaustive registry: adding a TemplateId without a template is a compile error. */
export const TEMPLATES: Record<TemplateId, CardTemplate>;
```

**Type-level guarantees (these are the reason the schema is shaped this way):**
- `qrZone` non-optional ⇒ **a template without a QR does not compile** (AC-07).
- `Record<TemplateId, CardTemplate>` ⇒ **a declared id without a template does not compile**.
- `backgroundSrc` is validated at test time: required when `background` involves a photo,
  `null` otherwise (AC-19).

### §8B.3 The eight templates — art direction (reference-derived, no longer `[ASSUMED]`)

Steer, per the reference analysis: our palette is warm-paper + deep-green, so the centre of
gravity is **earthy, tonal, editorial** — **Artemis is the closest reference in spirit** — with
**one saturated outlier (Marquee)** for range. Names are products, never numbers.

| # | Name | Category | `background` | `buttonFill` / `radius` / `icon` / `shadow` | `textOnMedia` | `avatarKind` | `typeFamily` | `qrZone.anchor` | Reference lineage |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Ledger** | business | `solid` — `--paper` | `tonal` / `rounded-rect` / `none` / `none` | `dark` | `photo` | `friendly-grotesk` | `above-actions` | Smythe's crisp rounded-rect, our paper ground |
| 2 | **Chapter** | business | `solid` — `--surface` | `tonal` / `pill` / `none` / `none` | `dark` | `photo` | `editorial-serif` | `below-identity` | Artemis's tonal restraint, editorial serif |
| 3 | **Foundry** | business | `solid+photo-split` — deep-green `#123A31` upper 62%, workshop still-life lower 38% | `white` / `rounded-rect` / `none` / `soft` | `light` | `logo-mark` | `friendly-grotesk` | `card-center` | **Artemis's exact construction**, our green |
| 4 | **Marquee** | event | `gradient-mesh` — deep-green → clay → amber, **muted, not neon** | `solid-accent` / `pill` / `none` / `none` | `light` | `photo` | `wide-display` | `card-center` | **Lane** — our one saturated outlier. **Opaque plate mandatory** |
| 5 | **Atrium** | creative | `photo` — full-bleed portrait, hard-cut to a `--surface` panel at 55% (no gradient fade) | `white` / `pill` / `leading-platform-chip` / `soft` | `light` | `photo` | `friendly-grotesk` | `above-actions` | **Balcombe** — floating white pills with a leading icon slot |
| 6 | **Almanac** | personal | `solid` — `--paper-sunk` with a `--clay` corner block and an `--amber` hairline | `tonal` / `pill` / `leading-emoji` / `none` | `dark` | `photo` | `editorial-serif` | `below-identity` | Artemis tonal + our warm signals |
| 7 | **Terminal** | business | `solid` — `--surface-raised`, strict 8px baseline, everything left-aligned, `--type-overline` labels | `tonal` / `rounded-rect` / `none` / `none` | `dark` | `logo-mark` | `condensed-bold` | `bottom-plate` | **Boultont's boldness, with AA contrast** (see §8B.6) |
| 8 | **Passage** | personal | `photo` — muted travel photograph behind a `--hairline-inset` frame at 12px, like a passport page | `translucent-textured` / `pill` / `none` / `none` | `light` | `photo` | `editorial-serif` | `card-center` | **Boultont's torn-edge texture**, contrast-corrected |

**Shipping bar:** all eight are specified; **six is the floor**. If Stage C must cut, drop
**Passage** then **Almanac** (both personal-category, and `translucent-textured` is the
highest-risk fill). Never drop **Foundry** or **Marquee** — they are the two that prove the
system spans tonal and saturated.

### §8B.4 Reference lessons carried, rejected and adapted

| | |
|---|---|
| **Carried** | the fixed skeleton · product names, never numbers · live-rendered gallery previews · the full button taxonomy · per-template typeface freedom · avatar-accepts-a-logotype (Artemis) · monochrome social glyph row |
| **Rejected** | sub-AA contrast pairings (Boultont's white-on-peach, Artemis's grey-on-sage) · `leading-emoji` as the **default** button icon — it is an allowed *variant* on exactly one template (Almanac), never the norm · the assumption that vertical space is free — our QR zone claims it first |
| **Adapted** | high-chroma → muted/earthy centre of gravity, one saturated outlier · 3–4 buttons → **exactly 2** · translucent textured fill → **α ≥ 0.92**, contrast-verified (§8B.6) |

### §8B.5 Gallery presentation (`/templates`) — confirmed by the references, not inferred

Linktree's model, measured from the supplied images:

- **Left vertical category rail.** Rail label above in `--type-overline`: `BROWSE BY CATEGORY`.
  Items are full-width pills; the active one is a filled `--ink` pill with `--paper` text, the
  rest are ghost with `--ink-muted` text. Categories: `All templates · Business · Personal ·
  Event · Creative`.
- **Right: a 3-up grid** (2-up at 768–1023px, 1-up below 768px) with **`--space-10` (40px)
  gutters** on a warm off-white ground (`--paper`).
- **Each cell is a tall rounded frame at ~1:2.15, `--radius-xl` (20px)**, containing a **live
  `<CardRenderer mode="thumb">`** — a real rendered mini card, not an abstract swatch. This is
  the single most important thing the reference gallery gets right.
- **The template NAME is a left-aligned sans caption BELOW the frame**, `--type-title-2`, with
  the `blurb` beneath it in `--type-body-sm` `--ink-muted`. The name is never inside the frame.
- Frames are `--elevation-0`. Separation comes from the gutter and the ground, not shadows.
- Closing band, Linktree's device, our copy: a `--type-display-1` line plus one CTA.

### §8B.6 ⚠ Per-template contrast audit — the check that can fail a beautiful template

**Boultont's white-on-peach button text is well under 4.5:1. Artemis's tonal grey-on-sage is
marginal.** We committed to WCAG 2.2 AA (Q26) on the app *and* public cards. So we borrow the
texture and the tonal idea and **reject those specific pairings**.

A static token sweep cannot catch this, because a template's text sits on a photograph, a
gradient or a translucent fill — the effective background is only known once rendered.
Therefore:

**`template-contrast.spec.ts` (Playwright, per template × per viewport):**
1. Render the card in `full` mode.
2. For each text node — name, bio, both button labels, field labels, the QR caption — take its
   `boundingBox()`.
3. Screenshot that box region and compute the **median luminance of the pixels beneath the
   text glyphs** (sample the background, excluding glyph pixels by luminance clustering).
4. Compute contrast against the node's computed `color`.
5. **Assert ≥ 4.5:1**, or ≥ 3:1 where computed `font-size ≥ 24px`.

Additional rules this enforces:
- `buttonFill: 'translucent-textured'` must composite to **α ≥ 0.92**, so the effective
  background is near-deterministic. Below that, step 3 is measuring noise.
- `textOnMedia: 'light'` over a `photo` or `gradient-mesh` background requires either a
  darkened overlay or a solid text panel — the test decides, not the designer's eye.

> **This test must be capable of failing a template that is otherwise beautiful, and when it
> does, the template changes — not the threshold.** A failing template is a **P1** and is fixed
> by darkening the ground, panelling the text, or changing the pairing. Relaxing the assertion
> is explicitly forbidden (§14.6).

---

## §8C — ANTI-AI-LOOK RULES (normative — these are requirements, not advice)

Vansh, Q7, verbatim: *"from the Ui perspective it should be the best modern but it should not
look AI made."*

This is a requirement with a pass/fail, not a vibe. Most of it is greppable.

### §8C.1 FORBIDDEN — each row is a lint assertion (AC-15)

| # | Forbidden | Detection |
|---|---|---|
| F-01 | Any raw colour literal (`#hex`, `rgb(`, `rgba(`, `hsl(`, `oklch(`) **outside `src/styles/tokens.css`** | regex sweep over `src/**/*.{ts,tsx,css}` |
| F-02 | `Instrument Serif` + `Inter` — the default generated pairing | family-name grep |
| F-03 | Purple/violet/indigo/fuchsia anywhere | covered by F-01; the palette contains none |
| F-04 | Gradient blobs, mesh backgrounds, `radial-gradient` blur decorations **outside `src/card/templates/**`** (Marquee's mesh is a declared, contrast-tested template axis — a decorative blob behind a marketing hero is not) | grep for `gradient` outside the allowlist |
| F-05 | Glassmorphism — `backdrop-blur`, `backdrop-filter` **anywhere** (also required by §6.8) | grep |
| F-06 | 3-up feature-card grids where each cell is `icon-in-a-rounded-square-tinted-chip` | grep for the chip class shape + manual review item M-2 |
| F-07 | Emoji as bullets or section markers in JSX text, outside `src/fixtures/**` | unicode-range regex |
| F-08 | "✨ Powered by AI"-style badges | grep for `✨`, `🚀`, `Powered by AI` |
| F-09 | `shadow-*` utilities / `box-shadow` **outside `src/components/overlay/**`** (plus the declared `buttonShadow: 'soft'` template path) | grep |
| F-10 | `rounded-2xl` / `rounded-3xl` **outside the mobile-sheet component** | grep |
| F-11 | `font-bold` / `font-semibold` / `font-extrabold` / `font-black` / `font-weight > 500` **outside `src/card/templates/**`** | grep |
| F-12 | Uniform reveal-on-scroll fade-up on every section — **`[data-reveal]` count ≤ 6 on `/`, and never on two consecutive sections** | DOM count assertion |
| F-13 | Marketing copy containing `Effortlessly`, `Seamlessly`, `Supercharge`, `Unlock the`, `Elevate your`, `game-changing`, `Say goodbye to`, `revolutionize`, `in seconds`, `Transform your` | grep over `src/fixtures/marketing.ts` |
| F-14 | shadcn default component markup shipped unretouched | no shadcn dependency exists; Radix primitives only (Q29) |
| F-15 | Generic stock-vector illustrations | asset review, manual item M-3 |
| F-16 | Centred-everything with no asymmetry on `/` | manual item M-1 + F-17 |
| F-17 | More than **3** of the 9 marketing sections using a centred single-column layout | DOM assertion |

### §8C.2 REQUIRED INSTEAD

- A real editorial type scale (§8.4) with **intentional asymmetry** — the marketing hero is
  left-aligned with a deliberately short measure and a text-link CTA, **not a filled button**
  (Hinge's exact device).
- **Photography and real product renders** — actual `<CardRenderer>` output — in place of
  illustration. The template showcase and the QR/scan demo both render **live components**, not
  images of components.
- Restraint in colour: the **80/20 rule**, measured (§8.3, AC-16).
- **Flat surfaces separated by hairline rules** (§8.7), not stacked shadowed cards.
- **Deliberate whitespace**: marketing sections are `--space-32` (128px) apart on desktop.
  Emptiness is the design.
- **Specific, plain copy.** Numbers and nouns, not adjectives. "One card. One QR. Every field
  you choose." not "Effortlessly supercharge your networking."
- **Numbered steps `01 / 02 / 03`** in `--type-overline` for how-it-works — no icons above the
  footer (§8.8).

### §8C.3 The three manual review items (the part no grep can decide)

Recorded here so §17 has something concrete to check and so the run does not pretend
automation covers everything:

- **M-1** — Does `/` read as an editorial page or as a template? Look for asymmetry, a real
  hero measure, and at least one section that breaks the grid.
- **M-2** — Is there a single 3-up icon-chip grid anywhere? If yes, it fails regardless of lint.
- **M-3** — Are the images real photographs / real renders, not stock vectors?

---
## §8D — SCREEN INVENTORY & STATE MATRIX (the frontend screen-making guide)

### §8D.1 The four state families — mandatory on every data screen

Vansh answered Q22 with **"[No preference]"**, delegating the decision. `[ASSUMED]` — **all
four families are mandatory on every data screen**, no exceptions:

| Family | Definition | Non-negotiable rules |
|---|---|---|
| **Loading** | data not yet available | **layout-matched skeletons, never a spinner.** The skeleton occupies the exact box the real content will, so nothing shifts. Shimmer is an opacity pulse, static under reduced motion. `aria-busy="true"` on the region. |
| **Empty — first run** | the collection is genuinely empty | Distinct copy and a **primary action**. "You haven't made a card yet" + "Create your first card". Never the same component as ↓ |
| **Empty — filtered to nothing** | a filter/search excluded everything | Different copy, and the action is **"Clear filters"**, not "Create". Conflating these two is a classic and it is banned here. |
| **Error / offline** | the request failed | §6.10 shape. `retryable` ⇒ a "Try again" button that calls `reset()`. **Partial failure renders what succeeded** plus an inline banner for what did not — never a whole-page error for a partial failure. |
| **Success / confirmation** | the normal state, and post-action feedback | Toast for reversible actions; inline confirmation for destructive ones. Every action's outcome is stated in words, never only by an icon. |

All are reachable via `?state=` (§6.3) and every one is covered by an axe pass (AC-25).

### §8D.2 The `(auth)` group — six screens, one question per page

**Shell** (`(auth)/layout.tsx`): `--paper` ground, single centred column at `max-width: 420px`,
vertical centring at ≥ 768px and top-aligned with `--space-16` below. **Progress indicator**: a
6-segment hairline bar under a `--type-overline` `STEP n OF 6`. **Back** is a top-left text
button, present on every screen except step 1, and is never destructive — entered values survive.
Right side on desktop ≥ 1280px: a static `--paper-sunk` panel showing one live
`<CardRenderer mode="thumb">` — the product, not a stock illustration.

| # | Route | The one question | Control | Validation (client-side only) | States |
|---|---|---|---|---|---|
| A-1 | `/signin/phone` | "What's your number?" | country-code `Select` (Radix) + `tel` input, `inputMode="tel"` | non-empty, 6–15 digits, digits only | success, **error** (inline, below field) |
| A-2 | `/signin/otp` | "Enter the code we sent" | 6 auto-advancing single-char boxes, paste-aware, `inputMode="numeric"`, `autoComplete="one-time-code"` | 6 digits | success, **loading** (verify button), **error** ("That code didn't match"), resend timer 30s |
| A-3 | `/signup/first-name` | "What's your first name?" | text, `autoComplete="given-name"` | 1–40 chars | success, error |
| A-4 | `/signup/last-name` | "And your last name?" | text, `autoComplete="family-name"` | 1–40 chars | success, error |
| A-5 | `/signup/email` | "Where can we reach you?" | email, `autoComplete="email"` | RFC-ish shape; **"Skip for now"** is a visible secondary | success, error |
| A-6 | `/signup/done` | — | — | — | success only; a live `thumb` of the starter card + "Go to dashboard" |

Rules for all six: headline at `--type-display-2` · helper copy at `--type-body-lg` `--ink-muted`
· exactly **one** primary action, full width on mobile · **Enter submits** · the first field is
focused on mount · errors are announced via `role="alert"` and referenced by
`aria-describedby` · the transition between steps is a 16px horizontal slide + fade at
`--dur-slow`, and **0ms under reduced motion**.

### §8D.3 The `(app)` group — shell

`(app)/layout.tsx`, per Q30:

- **Desktop ≥ 1024px:** left sidebar, `--sidebar-width: 240px`, `--paper-sunk` ground, right
  edge `--hairline`. Contents: wordmark (top), nav (Dashboard · Cards · Contacts · Profile),
  and the user chip at the bottom. Active item is an `--accent-wash` pill with `--accent` text
  and icon. **Collapsible to `--sidebar-collapsed: 68px`** (icons only, `aria-label` on each,
  tooltip on hover); the toggle persists in component state only.
- **Tablet 768–1023px:** sidebar starts collapsed.
- **Mobile ≤ 767px:** sidebar becomes a **bottom bar**, `--bottombar-height: 64px`, fixed, four
  items, icon + `--type-caption` label, top edge `--hairline`, `--surface` ground. Content gets
  `padding-bottom: calc(64px + env(safe-area-inset-bottom))`.
- Main region: `max-width: --content-max (1200px)`, `--space-16` top padding, `--space-8` sides.
- Page header pattern: `--type-display-3` title, optional `--type-body-sm` `--ink-muted`
  subtitle, actions right-aligned, `--hairline` beneath.
- **Skip link** to `#main` is the first focusable element (AC-26).

| Screen | Route | Desktop layout | Mobile layout | Component inventory |
|---|---|---|---|---|
| **Dashboard** | `/dashboard` | 2-col: left = 3 stat blocks in a hairline-ruled row (Cards · Contacts · Fields), right = the most-recently-updated card as a live `thumb` + "Open builder"; below, a "Recent contacts" list of 5 | stacked; the card `thumb` first | `StatRow`, `CardThumbTile`, `ContactRow`, `EmptyState` |
| **Cards list** | `/cards` | header + "New card" primary; grid of `CardThumbTile` — 3-up ≥1280px, 2-up 768–1279px | 1-up | `CardThumbTile` (thumb, name, `CardType` chip, template name, **field-count badge**), `FilterBar`, `EmptyState` |
| **Card detail** | `/cards/[cardId]` | 2-col: left = `<CardRenderer mode="full">` pinned; right = metadata, field list, actions (Edit · Share · Export PNG · Delete) | stacked, card first | `CardRenderer`, `FieldList`, `ShareSheet`, `ConfirmDialog` |
| **Card builder** | `/cards/new`, `/cards/[cardId]/edit` | **split view — see §8D.4** | preview pinned to the top ~45vh, controls scroll beneath | `BuilderSplit`, `TemplatePicker`, `FieldPicker`, `ThemeControls`, `FieldCountMeter` |
| **Contacts list** | `/contacts` | search + category filter; a hairline-ruled table (Name · Source card · Saved) — **width is why this is desktop-first (Q16)** | the same rows collapse to a stacked list, table semantics dropped for a list | `SearchField`, `FilterChips`, `ContactTable`, `EmptyState` (×2 kinds) |
| **Contact detail** | `/contacts/[contactId]` | 2-col: left = identity + avatar; right = captured fields grouped by category + "From card {name}" link | stacked | `FieldList`, `SourceCardLink` |
| **Profile** | `/profile` | identity block, then one collapsible section per `FieldGroup`, each listing its `ProfileField`s with inline edit, a sensitivity toggle, and "Add field" | stacked, sections collapsed by default | `IdentityBlock`, `FieldGroupSection`, `FieldRow`, `SensitiveToggle`, `AddFieldPopover` |
| **Field group** | `/profile/groups/[groupId]` | focused editor for one group: reorder, add, edit, delete — delete warns **how many cards use the field** | same | `FieldGroupEditor`, `ConfirmDialog` |

**Per-screen states** — every row above implements all four families of §8D.1. Concretely:

| Screen | Loading | Empty (first run) | Empty (filtered) | Error / offline |
|---|---|---|---|---|
| Dashboard | 3 stat skeletons + one card-shaped skeleton | "Nothing here yet" + "Create your first card" | n/a | panel error + retry |
| Cards list | grid of 6 card-shaped skeletons at the real aspect | "You haven't made a card yet" + primary CTA | "No cards match that filter" + **Clear filters** | error + retry |
| Card detail | card-shaped skeleton + 5 field-row skeletons | **not-found** (invalid id) → dedicated 404 panel, not an empty state | n/a | error + retry |
| Builder | preview skeleton + control skeletons | **empty card**: preview renders name-only **with the §11 E-01 warning**, and Save is blocked | n/a | error + retry, edits preserved in local state |
| Contacts list | 8 row skeletons | "No saved contacts yet" + an explanation of how contacts arrive (a scan) | "No contacts match" + **Clear filters** | error + retry |
| Contact detail | identity + field skeletons | not-found panel | n/a | error + retry |
| Profile | identity + 3 group skeletons | group present but empty → "No fields in {group} yet" + "Add field" | n/a | error + retry |
| Field group | field-row skeletons | same as Profile | n/a | error + retry |

### §8D.4 The card builder — split view (Q10), and the four bugs it is designed to prevent

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ← Cards   ·   Card name [inline editable]        Field count: 5 ●   [Save]   │
├───────────────────────────────────┬──────────────────────────────────────────┤
│                                   │  Tabs (Radix):  Template · Fields · Theme│
│   PINNED LIVE PREVIEW             │  ────────────────────────────────────────│
│   <CardRenderer mode="full">      │                                          │
│   400×860, sticky, never scrolls  │  Template ▸ 3-up grid of live `thumb`    │
│   out of view                     │             previews; selected = 2px     │
│                                   │             --accent ring + a tick       │
│   ┌───────────────────────┐       │                                          │
│   │  avatar / name / bio  │       │  Fields   ▸ grouped by FieldCategory,    │
│   │  ▓▓ PROTECTED QR ▓▓   │       │             a checkbox per ProfileField, │
│   │  [ Save to contacts ] │       │             sensitivity marker, live     │
│   │  [ Message on WA    ] │       │             count, "Add a field" deep    │
│   │  fields · socials     │       │             link to /profile             │
│   └───────────────────────┘       │                                          │
│                                   │  Theme    ▸ the template's own knobs:    │
│                                   │             buttonRadius, buttonFill,    │
│                                   │             avatarKind, textOnMedia      │
├───────────────────────────────────┴──────────────────────────────────────────┤
│  ⚠ This card maps 0 fields. Anyone who scans it will only get your name.      │  ← E-01
│    [ Add fields ]                                              Save disabled  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Desktop: preview ~46% / controls ~54%, preview `position: sticky`. Mobile: preview pinned to
the top ~45vh with the controls scrolling beneath; the preview is never pushed off-screen.

**Every interaction is live.** Ticking a field, picking a template or changing a theme knob
updates the preview on the next frame. There is no "apply", no "next", no wizard step.

Designed directly against the four failures the old build recorded:

| Old failure | This design |
|---|---|
| Card with 0 mappings shipped and produced a 73-byte name-only `.vcf` | a persistent **field-count meter** in the header; a blocking warning bar; **Save disabled at zero** (§11 E-01, AC-36) |
| Step 2 embedded a 12-row profile editor, giving one screen two competing commits ("Save details" vs "Next") | the builder has **exactly one commit affordance: Save**. Adding a profile field is a **deep link to `/profile`**, not an embedded editor |
| Step 3 taught a template choice that was thrown away on Create | `templateId` is a persisted field of `ContactCard` (§5.4) and the preview shows it from the first frame |
| The share dialog previewed nothing, so the previewed file could differ from the sent file | preview and payload are **the same `ResolvedCard` reference** (I-5). They cannot diverge |
| A tour anchor sat on a tab panel that only exists while that tab is active | any future anchor attaches to the **header**, which always exists. No anchor may target a tab panel |

### §8D.5 The public card page — `/c/[slug]`

The screen the whole product exists for. Mobile-first (Q16): it is reached from a phone camera.

- **No app chrome.** No sidebar, no bottom bar, no marketing nav. `--paper` ground.
- **≤ 767px:** the card fills the viewport width minus `--space-3` on each side (min `336px`),
  vertically centred when it fits, top-aligned and scrollable when it does not.
- **≥ 768px:** the card is centred at its `400px` design width on a `--paper` field, with a
  single `--type-caption` `--ink-muted` line beneath: "Made with Contact Book" linking to `/`.
- Renders `<CardRenderer mode="full">` with the card's **own** `templateId`.
- **Primary: "Save to contacts"** (.vcf, §6.9). **Secondary: "Message on WhatsApp"**. Exactly
  two (§8A.2).
- `generateMetadata` produces per-card `title`, `description` and an OG image
  (`opengraph-image.tsx` rendering the card at 1200×630). SSR, per Q3.
- **States:** loading = card-shaped skeleton at the exact aspect · empty = a card with 0 fields
  renders name-only **and the Save button is not rendered at all** (§11 E-02) · error/offline =
  §6.10 panel with "Go home" · **not-found** = a dedicated panel, "This card doesn't exist or
  was removed", never a raw 404.

### §8D.6 The `(marketing)` group — one scrollable page, nine sections

Q7: one page, multi-section, "best modern", must not look AI-made. Q20: all sections.
Nav: a floating rounded **pill** bar (Linktree's device), `--surface`, `--elevation-1`
(it is fixed, so it qualifies), sitting on the `--paper` ground. Left wordmark; centre
Templates · How it works · Pricing; right a ghost "Log in" pill and a filled `--accent`
"Get started" pill.

| # | Section | Content | Layout | Motion |
|---|---|---|---|---|
| M-1 | **Hero** | `--type-display-hero`, **left-aligned**, short measure; one-line subhead; **a text-link CTA, not a filled button** (Hinge's device); to the right, a live `<CardRenderer mode="full">` at a slight angle | asymmetric 2-col ≥1024px; stacked below | static — the hero never animates in |
| M-2 | **How it works** | three steps, `01 / 02 / 03` in `--type-overline`, no icons | 3-col ≥1024px, hairline-separated | none |
| M-3 | **Template showcase** | live `thumb` renders of all 8 templates | horizontal scroll-driven strip | **scroll-driven moment 1** (Q32) |
| M-4 | **QR / scan demo** | a real card with a real QR; copy explaining a scan; an animated scan sweep across the plate | 2-col ≥1024px | **scroll-driven moment 2** — the only two on the page |
| M-5 | **Social proof** | 3 testimonials, `--type-display-quote`, **no borders, no shadows, no avatars** (Hinge does exactly this) | 3-col ≥1024px | none |
| M-6 | **Fields / what a card can carry** | the 21 `FieldType`s as a plain typographic list, grouped by category | 2-col text block | none |
| M-7 | **FAQ** | 6 questions, Radix `Accordion`, hairline-separated, no card frames | single column, `--prose-max` | height transition at `--dur-base` |
| M-8 | **Pricing** | 2 plans, hairline-ruled columns, **not** shadowed cards; CTAs → `/signin/phone` | 2-col ≥768px | none |
| M-9 | **Final CTA + footer** | `--type-display-1` closing line + one CTA; then a multi-column footer on `--paper-sunk` | — | none |

Section rhythm: `--space-20 / --space-24 / --space-32` padding-y at mobile / tablet / desktop.
**At most 3 of the 9 sections may be centred single-column** (F-17). `[data-reveal]` count on
this page **≤ 6**, never on consecutive sections (F-12).

`/` is the only route with **no `loading.tsx`** — it is fully static with no fixture read.

### §8D.7 Component library inventory

`apps/web/src/components/` — Radix primitives for behaviour, 100% of the visual layer ours (Q29).

| Directory | Components | Radix primitive used |
|---|---|---|
| `primitives/` | `Button` (primary · secondary · ghost · destructive · text-link), `Input`, `TextArea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Label`, `Chip`, `Badge`, `Avatar`, `Skeleton`, `Rule` | `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Label`, `Avatar` |
| `overlay/` | `Dialog`, `ConfirmDialog`, `Popover`, `DropdownMenu`, `Tooltip`, `Toast`, `Sheet` — **the only directory permitted `--elevation-1/2`** | `Dialog`, `Popover`, `DropdownMenu`, `Tooltip`, `Toast` |
| `layout/` | `AppShell`, `Sidebar`, `BottomBar`, `PageHeader`, `SplitView`, `SkipLink` | — |
| `data/` | `EmptyState`, `ErrorPanel`, `NotFoundPanel`, `LoadingSkeleton`, `FilterBar`, `SearchField`, `DataTable` | `Tabs` |
| `marketing/` | `PillNav`, `Hero`, `StepList`, `TemplateStrip`, `ScanDemo`, `QuoteBlock`, `FaqAccordion`, `PricingColumns`, `SiteFooter` | `Accordion` |
| `card/` (under `src/card/`) | `CardRenderer`, `QrZone`, `CardFrame`, `CardAvatar`, `CardButtonStack`, `CardFieldRow`, `CardSocialRow`, plus `templates/*.ts` | — |

**Button anatomy** (one component, five variants, two sizes 40px / 52px): label at
`--type-label`, radius `--radius-md` in the app and per-template in cards, `--elevation-0` in
the app, `:focus-visible` from the single global rule (§8.3), `:disabled` at `--ink-faint` on
`--paper-sunk` with `cursor: not-allowed` and an `aria-disabled` explanation.

---
## 9. Dependencies

### 9.1 Internal modules relied on

- `apps/web/src/fixtures/**` — the only data source (§3.1).
- `@repo/types`, `@repo/utils` — already wired via `transpilePackages`. **Neither is modified
  and neither is newly imported.** They exist; this run does not need them.
- `apps/web/src/lib/api.ts` — **not imported, not called, not changed.**

### 9.2 External services

**None at runtime.** This is the direct benefit of the §3.1 wall: the built app makes zero
outbound requests. No API, no CDN, no font CDN (fonts are self-hosted at build time by
`next/font`), no analytics, no image proxy to a third party.

### 9.3 New packages

| Package | Kind | Why | Licence |
|---|---|---|---|
| `@radix-ui/react-{dialog,popover,select,tabs,tooltip,dropdown-menu,checkbox,radio-group,switch,label,accordion,avatar,toast,visually-hidden}` | dep | Q29 — focus management + ARIA solved; visuals 100% ours | MIT |
| `lucide-react` | dep | icon set, §8.8 | ISC |
| `qrcode` | dep | QR generation → inline SVG, ECC `H`, `margin: 0` | MIT |
| `html-to-image` | dep | PNG export, §6.8 | MIT |
| `clsx` + `tailwind-merge` | dep | className composition; small, standard, not shadcn-specific | MIT |
| `vitest`, `@vitejs/plugin-react`, `happy-dom` | dev | unit + contract runner | MIT |
| `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` | dev | component tests | MIT |
| `@playwright/test` | dev | real-layout geometry, a11y, scannability, edge | Apache-2.0 |
| `@axe-core/playwright` | dev | WCAG 2.2 AA sweeps | MPL-2.0 |
| `jsqr` | dev | **decodes screenshots — the ground-truth QR test (QR-T5/T6)** | Apache-2.0 |
| `pngjs` | dev | reads PNG pixels for `jsqr` and the contrast/80-20 audits | MIT |

**No `zod`** — validation is client-side format checking on five auth fields; TypeScript plus a
handful of predicates covers it, and a schema library would be a dependency with no consumer.
**No state library** — React state and one context are sufficient for fixtures.
**No `next-themes`** — there is no dark mode (NG4).
**No animation library** — CSS transitions plus `animation-timeline: view()`; a library would
make the reduced-motion override (§8.9) harder, not easier.

### 9.4 Behaviour when each dependency is unavailable

| Dependency | Unavailable how | Behaviour | Mitigation |
|---|---|---|---|
| Google Fonts | unreachable at **build** time | `next build` fails | fonts are fetched once at build and self-hosted into `.next`; **runtime never contacts Google**. `fallback` metrics (`Georgia` / `system-ui`) plus `adjustFontFallback: true` mean a font that fails to *load* degrades to a metric-matched fallback with ~0 CLS |
| `qrcode` | throws on encode | `<QrZone>` renders an error plate: an opaque plate with "QR unavailable" in `--danger` **and the card's action buttons still work** — a card without a QR must never be a blank card | covered by §11 E-30 |
| `html-to-image` | export throws | `ExportFailedError`, toast with retry, spinner always cleared | §11 E-44 |
| Radix | n/a — bundled | — | — |
| Playwright browsers | not installed | test suite fails loudly at setup with the install command | §17.2 documents `pnpm exec playwright install chromium` |
| A template's `backgroundSrc` image | 404 or corrupt | template falls back to its `palette.ground` solid; **`textOnMedia` is re-evaluated against that solid** so text never becomes unreadable | §11 E-21 |

---

## 10. State, Storage, Config

### 10.1 Store choice

**React state only.** No database, no `localStorage`, no `sessionStorage`, no cookies, no
IndexedDB, no server state.

- Fixture data is a frozen module-level object read through `useFixture` (§6.3).
- Mutations in the builder and profile live in a `useReducer` scoped to the route group and are
  **lost on reload, by design** (§5.7).
- The simulated auth flag lives in `FixtureAuthProvider` (§7.1) and is likewise in-memory.

Stated explicitly so no executor "helpfully" adds persistence — that would be the first crack
in the §3.1 wall.

### 10.2 Schema / migration

`N/A — no persistence layer exists in this run.` `apps/api/prisma/schema.prisma` stays empty
and is on the do-not-touch list (§3.3). Two fields the API will eventually need are flagged
in §5.4: `ContactCard.templateId` and `ContactCard.slug`.

### 10.3 Seed data — the fixtures

`apps/web/src/fixtures/`

| File | Contents | Notes |
|---|---|---|
| `user.ts` | one `User`, with and without `avatarUrl` variants | drives §11 E-19 |
| `profile.ts` | 7 `FieldGroup`s (one per `FieldCategory`) and **≥ 25 `ProfileField`s covering all 21 `FieldType`s** | every renderer must be exercised (AC-21) |
| `cards.ts` | **9 cards**: one per template (8), plus **`card_empty_demo` with `fieldIds: []`** | the empty card is a permanent fixture, not a test-only artefact — see §11 E-01 |
| `contacts.ts` | 12 `Contact`s, incl. one with `sourceCardSlug` dangling | drives §11 E-39 |
| `extremes.ts` | the §11 hostile-content set: 40+ char name / job title / company; 25-field card; 1-field card; missing avatar; broken image URL | drives the `edge` dimension |
| `marketing.ts` | all copy for the 9 sections | swept by F-13 |

Fixtures are typed against `src/types/domain.ts` and `as const`-frozen. A fixture that violates
an invariant is a **compile error**, not a runtime surprise.

### 10.4 Caching

`N/A — nothing is fetched.` Marketing and auth routes are statically rendered.
`/c/[slug]` and the other dynamic routes render from fixtures at request time so `?state=`
works; no `revalidate`, no `cache` directives, no `unstable_cache`.

### 10.5 Environment variables

| Var | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | the origin baked into `qrPayload` (§8A.6). Public by definition |

That is the complete list. `NEXT_PUBLIC_API_URL` exists in `src/lib/api.ts` and is **not used
by anything this run builds**. `.env` files are neither created nor required — every default is
safe locally.

---

## 11. Edge Cases & Failure Modes

This table seeds the tester's `edge` dimension directly. It is intended to be exhaustive.
`[ASSUMED]` marks a case I added that Vansh did not select — with the reason stated.

### 11.1 Empty, degenerate and boundary content

| # | Scenario | Expected behaviour | Severity if wrong |
|---|---|---|---|
| **E-01** | **A card maps ZERO profile fields, in the builder** `[ASSUMED — see §11.6]` | Builder shows a persistent `--warning-wash` bar: *"This card maps 0 fields. Anyone who scans it will only get your name."* + an **"Add fields"** action. The **Save button is `disabled` with `aria-disabled` and an explanation.** The preview still renders (name only) so the consequence is visible, not hidden. | **P0** |
| **E-02** | **A card with zero fields is rendered publicly** `[ASSUMED]` | `/c/[slug]` renders name + QR. **"Save to contacts" is NOT rendered at all** (not rendered-and-disabled). A `--type-caption` line reads *"This card doesn't share any details yet."* `buildVcf` is never called, so the 73-byte `.vcf` cannot be produced. | **P0** |
| **E-03** | A card maps 1 field | Renders correctly; the field row does not stretch to fill; the layout does not collapse; the QR zone keeps its full reserved region. | P1 |
| **E-04** | A card maps 25+ fields | The field row **scrolls within its slot**; the QR zone and both action buttons **never move and never shrink**; the card does not exceed its 860px canvas — overflow is contained, not pushed. | **P0** (a QR pushed off-canvas is a dead card) |
| **E-05** | Bio resolves to > 3 lines | Clamped to 3 lines with an ellipsis; `title` attribute carries the full text; the QR zone does not move. | P1 |
| **E-06** | No bio at all (no `TEXT`, no `JOB_TITLE`, no `COMPANY`) | The bio slot **collapses** — no reserved empty space, no `&nbsp;` placeholder. | P2 |
| **E-07** | A `ProfileField` has `value: ''` | Excluded from `ResolvedCard.fields` entirely and omitted from the `.vcf` (§6.7). Never rendered as an empty row. | P1 |
| **E-08** | A profile has zero fields in every group | `/profile` shows the per-group empty state; every card builder shows E-01; `/cards` still lists cards. | P1 |
| **E-09** | The user has zero cards | Cards list shows the **first-run** empty state with a primary CTA; dashboard shows its own empty state; **neither shows the "filtered to nothing" variant**. | P1 |

### 11.2 Long content — Vansh's selected extremes (Q31)

| # | Scenario | Expected behaviour | Severity if wrong |
|---|---|---|---|
| **E-10** | **Name 40+ characters** on a `full` card | Wraps to a maximum of **2 lines** at `--type-display-3`, then clamps with an ellipsis. **The QR zone does not move.** No horizontal overflow at 360px. | **P0** |
| **E-11** | Job title 40+ characters | Clamped to 1 line with an ellipsis in the bio composition; full text in `title`. | P1 |
| **E-12** | Company name 40+ characters | Same as E-11; in `"{title} at {company}"` the **company** truncates first. | P1 |
| **E-13** | Name 40+ chars in a `thumb` tile | Clamps to 1 line; the tile keeps its grid cell width; the grid does not reflow. | P1 |
| **E-14** | Name 40+ chars in the sidebar user chip | Truncates with an ellipsis; the sidebar stays exactly 240px. | P2 |
| **E-15** | A single unbroken 60-character token (a long URL or email) | `overflow-wrap: anywhere` on field values; **never** horizontal page scroll. Asserted as `scrollWidth <= clientWidth` on `[data-card-root]`. | **P0** |
| **E-16** | 40+ char values in the `.vcf` | Lines fold at 75 octets per RFC 2426 (§6.7); the file still imports. | P1 |
| **E-17** | 40+ char name in the exported PNG | Same clamping as E-10; the PNG **still decodes** (QR-T6). | **P0** |
| **E-18** | A long name pushes the card content past 860px | Content is clamped **before** overflow; the QR zone has a `min-height` floor it never yields. | **P0** |

### 11.3 Missing and broken media — Vansh's selected extreme (Q31)

| # | Scenario | Expected behaviour | Severity if wrong |
|---|---|---|---|
| **E-19** | **`User.avatarUrl` is `null` and no `PHOTO` field is mapped** | `ResolvedAvatar` resolves to `{ kind: 'monogram' }`: a circle in the template's `markFill` with 1–2 initials in `--type-title-1`, contrast-verified like any other text. **Never a broken-image icon, never a grey blob, never an empty circle.** | **P1** |
| **E-20** | **Avatar URL 404s or is corrupt** | `onError` swaps to the monogram fallback. No layout shift — the monogram occupies exactly the same 80px box. `alt` text is present either way. | **P1** |
| **E-21** | A template's `backgroundSrc` 404s | Falls back to `palette.ground`; `textOnMedia` is re-evaluated against that solid so text cannot become unreadable (§9.4). | **P1** |
| **E-22** | The avatar image is very slow | Reserved 80px box from first paint (explicit `width`/`height`); **CLS contribution 0**. | P2 |
| **E-23** | A `SOCIAL_LINK` hostname is unrecognised | Renders a generic link glyph plus the hostname; never an empty icon slot, never a crash. | P2 |

### 11.4 QR-specific failure modes (each maps to a §8A.7 test)

| # | Scenario | Expected behaviour | Severity if wrong |
|---|---|---|---|
| **E-24** | A template's decoration overlaps the reserved region | **QR-T3 fails the build.** No visual-review path can approve it. | **P0** |
| **E-25** | Viewport is 360px, so the card is only 336px wide | QR stays at the **absolute 140px floor**; the card lays out with container queries, **never** `transform: scale()` on content. QR-T1 asserts ≥140 at 360px. | **P0** |
| **E-26** | A template sets a translucent or gradient plate | **QR-T2 fails** on `alpha === 1` / `background-image === 'none'`. | **P0** |
| **E-27** | A template uses `backdrop-filter` for a frosted plate | Forbidden by F-05 (lint) **and** QR-T2. It would also vanish silently in the PNG export (§6.8). | **P0** |
| **E-28** | The centre mark exceeds 20% of the symbol area | **QR-T4 fails.** ECC H's 30% budget must retain headroom for glare and print wear. | **P0** |
| **E-29** | The slug is long enough to push the symbol past version 6 | `qrPayload.length ≤ 60` asserted at fixture-build time (AC-08); over the cap is a compile/test failure, not a runtime degradation. | P1 |
| **E-30** | `qrcode` throws while encoding | Opaque plate with "QR unavailable" in `--danger`; **the action buttons still work**; the card is never blank (§9.4). | P1 |
| **E-31** | A `thumb` render is checked for scannability | **Asserted to be non-decodable** (AC-09). This is correct behaviour, not a bug. | P2 (a false P0 wastes a fix round) |
| **E-32** | The exported PNG decodes on screen but not after rasterisation | **QR-T6 catches it.** This is precisely where silent QR failures hide. | **P0** |
| **E-33** | Two `[data-qr-zone]` elements render in one card | Invariant I-3 fails in the contract suite. | **P0** |

### 11.5 Interaction, routing, state and hostile input

| # | Scenario | Expected behaviour | Severity if wrong |
|---|---|---|---|
| **E-34** | `?state=` carries an unrecognised value (`?state=banana`) | Falls back to `success`. **Never throws, never blanks the page.** | P1 |
| **E-35** | `?state=loading` is visited | The skeleton renders and **never resolves** — that is the point. It must not spin forever *and* also error. | P2 |
| **E-36** | `/cards/[cardId]` with an id that does not exist | The dedicated **not-found panel**, not an empty state and not a raw 404. | P1 |
| **E-37** | `/c/[slug]` with an unknown slug | *"This card doesn't exist or was removed"* + "Go home". Never a stack trace, never a raw 404. | P1 |
| **E-38** | `/cards/new` vs `/cards/[cardId]` | Static segment wins; fixture ids are `card_…`-prefixed so a card can never be addressed as `new` (AC-05). | P1 |
| **E-39** | A `Contact.sourceCardSlug` dangles | The "From card" link is **not rendered**; the rest of the contact renders. Never a link to a 404. | P2 |
| **E-40** | A card's `fieldIds` contains an id no longer in the profile | `resolveCard` drops it and reports it via `droppedFieldIds`; the builder shows *"2 fields were removed from your profile"*. **Never a ghost row, never a crash** (I-2). | P1 |
| **E-41** | A profile field is deleted while a card maps it | Confirm dialog states **how many cards use it** before deleting; afterwards E-40 applies. | P1 |
| **E-42** | Rapid template switching in the builder (10 clicks in 2s) | The preview settles on the last selection; no torn render, no leaked timers, no stale template. | P1 |
| **E-43** | Export is tapped twice quickly | The second call is ignored while the first is in flight; the button shows a busy state; exactly one file downloads. | P1 |
| **E-44** | Export fails | `ExportFailedError` → toast with retry; **the spinner is always cleared**; the card is untouched. | P1 |
| **E-45** | Sidebar collapsed, then the viewport crosses to mobile | The bottom bar takes over cleanly; no orphaned collapsed rail; no double navigation. | P2 |
| **E-46** | Browser back mid-auth-flow | Previously entered values are preserved; Back is never destructive (§8D.2). | P1 |
| **E-47** | A 6-digit OTP is pasted into the first box | Distributes across all six boxes and focuses the last. | P2 |
| **E-48** | Keyboard-only traversal of the builder | Every control reachable; the visible focus ring clears 3:1 on **every** ground including accent fills and photographic templates (§8.3). | **P0** (AA) |
| **E-49** | `prefers-reduced-motion: reduce` | All durations 0ms; scroll-driven sections at their end state immediately; skeleton shimmer static; nothing auto-plays (AC-27). | P1 |
| **E-50** | A dialog is open and `Escape` is pressed | Closes and returns focus to the trigger (Radix behaviour, asserted rather than assumed). | P1 |
| **E-51** | A fixture string contains `<script>` or `<img onerror=…>` | Rendered as **text**. No `dangerouslySetInnerHTML` exists anywhere (§7.3, AC-32). | **P0** |
| **E-52** | A fixture value contains `,` `;` `\` and reaches the `.vcf` | Escaped per RFC 2426; the file still imports (§6.7). | P1 |
| **E-53** | 360px viewport, the longest fixture name, the 25-field card, and the tallest template together | **No vertical overflow past 722px and no horizontal overflow.** The worst realistic case, asserted explicitly (AC-35). | **P0** |
| **E-54** | Zoom to 200% (WCAG 2.2 1.4.4) | No content loss, no horizontal scroll on `(app)` routes at 1280×1024 zoomed to 200%. | P1 |
| **E-55** | A template's button label at 40+ chars | Clamps to 1 line inside the button; the button height stays 52px; the QR zone does not move. | P1 |
| **E-56** | A card maps no `PHONE` field at all | The **"Message on WhatsApp" button is not rendered** — never rendered-and-disabled. "Save to contacts" remains, full width. The action row collapses from two buttons to one without leaving a gap. | P1 |

### 11.6 ⚠ On E-01/E-02: I am overriding Vansh's deselection, deliberately

**Q31 asked which content extremes to guard. Vansh selected long names and missing avatars, and
explicitly did NOT select "card with 1 field vs 25+ fields."**

**I am including the empty-card and field-count guards anyway (E-01, E-02, E-03, E-04), and I am
saying so plainly rather than slipping them in.** The reason:

> The old build's own `decision-context.md` records this **as a shipped production bug**, not as
> a hypothetical. Card `5a286f9e` had **0 field mappings**. Its generated `.vcf` was **73 bytes**
> — `FN` and `N` and nothing else. It got worse: presets were ranked by `updatedAt desc`, so the
> newest card — which is always the empty one, because it was just created — was **preselected**,
> and copying it copied nothing.

A user who scans that card gets a name and no way to contact anyone. That is a total product
failure produced by a guard that did not exist. Rebuilding the card system without the guard
would be repeating a documented, known, already-paid-for mistake.

**The cost of including it is one warning bar, one disabled button, and one permanent fixture
(`card_empty_demo`).** The cost of omitting it is the same bug, again.

**Vansh: if you disagree, say so at Gate 1 and I will remove E-01–E-04 and AC-36.** This is
flagged rather than buried precisely so that is an easy call to make.

---

## 12. Non-Functional Requirements

### 12.1 Targets (all measurable by a stated command)

| # | Target | Measured by |
|---|---|---|
| N-1 | `next build` completes in **< 180s** on the dev machine | `time pnpm --filter web build` |
| N-2 | First Load JS for `/` **≤ 165 kB** and for `/c/[slug]` **≤ 180 kB** | the `next build` route table |
| N-3 | The two card-only typefaces (Archivo, Bricolage Grotesque) do **not** appear in the `/` or `(auth)` bundles | build output + AC-17 |
| N-4 | **CLS = 0** on `/` and `/c/[slug]` | Playwright `PerformanceObserver`, `layout-shift` entries |
| N-5 | LCP on `/c/[slug]` **< 1.5s** at Playwright's default throttling | Playwright trace |
| N-6 | A builder interaction (tick a field / pick a template) repaints in **≤ 1 animation frame**, no visible lag at 60fps | Playwright trace on 20 rapid interactions |
| N-7 | The full Playwright suite finishes in **< 10 minutes** | `time pnpm --filter web test:e2e` |

### 12.2 Expected load

`N/A for this run` — no server, no concurrency, no throughput dimension. `next start` serves
static and fixture-rendered routes only.

### 12.3 Explicitly NOT a concern yet (this is the anti-over-engineering list)

Bundle-splitting beyond Next's defaults · image CDN or responsive `srcset` tuning · service
worker / real offline support (the "offline" state is a *presentation*, not PWA behaviour) ·
SSR streaming and Suspense boundary tuning beyond what `useSearchParams` requires ·
i18n bundle sizing · SEO beyond per-route `metadata` + one OG image · rate limiting · caching ·
memoisation micro-optimisation (fixture datasets are tens of records) · virtualised lists ·
Core Web Vitals field data.

---

## 13. Observability

### 13.1 What exists

There is no server and no telemetry (NG7), so "observability" here means: **when this breaks,
what makes the failure visible?**

- **Error boundaries** at four levels: root, `(app)`, `(auth)`, `(marketing)`, plus
  `/c/[slug]`. Each renders the §6.10 panel and never a white screen.
- **`not-found.tsx`** at root and a dedicated not-found panel on every dynamic route.
- **Structured `console.error`** inside every `error.tsx`, one shape, and **no PII**:
  ```ts
  console.error('[contactbook]', { scope: 'app|auth|marketing|public-card',
                                   route: '/cards/[cardId]', digest: error.digest,
                                   message: error.message });
  ```
- **`digest`** is surfaced in the UI as a muted, selectable caption when present, so a
  screenshot from Vansh is enough to locate a failure.

### 13.2 The observability that actually pays here: test-visible state attributes

Because the failure modes of this run are *visual and geometric*, the highest-value
instrumentation is DOM attributes tests can assert on without brittle text matching. These are
a **contract**, not debug leftovers:

| Attribute | On | Used by |
|---|---|---|
| `data-card-root`, `data-template-id`, `data-render-mode` | card root | every card test |
| `data-qr-zone`, `data-qr-symbol`, `data-qr-plate`, `data-qr-mark`, `data-qr-mode` | QR subtree | QR-T1…T6 |
| `data-screen-state="loading\|empty\|empty-filtered\|error\|offline\|success"` | every data screen's root | state + a11y sweeps |
| `data-field-count` | builder header | AC-36 |
| `data-reveal` | marketing reveal sections | F-12 |
| `data-elevation="0\|1\|2"` | overlay roots | F-09 |

### 13.3 What is deliberately absent

No Sentry, no analytics, no RUM, no `performance.mark` in production code, no logging library,
no log levels. Adding any of them would be scope creep on a UI-only run.

---

## 14. Testing Strategy

### 14.1 Definition of "tested" for this work

This is a UI run, so the usual unit-heavy pyramid is wrong. Most of what can break here is
**geometry, contrast and rasterisation** — none of which a jsdom unit test can see. The
weighting is therefore inverted on purpose:

| Layer | Share | Runner | Why |
|---|---|---|---|
| Static gates | — | `tsc --noEmit`, `eslint` | must be clean before anything else runs |
| Unit | ~20% | Vitest + happy-dom | pure logic only: `resolveCard`, `buildVcf`, contrast maths, formatters, clamps |
| Contract | ~20% | Vitest | template registry, token parity, field-renderer completeness, route manifest completeness |
| **Geometry + scannability** | **~30%** | **Playwright + `jsqr`** | **QR-T1…T6 — the ground truth of this product** |
| A11y + contrast | ~20% | Playwright + axe + pixel sampling | WCAG 2.2 AA (Q26) and the per-template audit (§8B.6) |
| Edge | ~10% | Playwright | every row of §11 |

**Coverage bar:** line coverage is not a goal and is not gated. The gates that matter are:
**100% of §11 rows have a test**, **100% of §15 ACs have a test**, and **100% of templates ×
viewports pass QR-T1…T6**.

### 14.2 Mock vs real

| Dependency | Approach |
|---|---|
| The API | **does not exist** — fixtures are the real thing here, not mocks |
| Fonts | **real**, self-hosted by `next/font`; tests wait on `document.fonts.ready` before any geometry or contrast assertion (a font that swaps mid-measure is the #1 source of flaky layout tests) |
| Images | **real** files under `public/`; the broken-image case uses a genuinely absent path |
| QR encode | **real** `qrcode` |
| QR decode | **real** `jsqr` against **real screenshots** — never a mocked decode. A mocked decoder would defeat the entire purpose of QR-T5 |
| Browser | **real** Chromium via Playwright. jsdom/happy-dom has no layout engine and **cannot** be used for any geometry assertion |

### 14.3 The test matrix

- **Viewports:** `360×800` (min supported), `768×1024`, `1440×900`. Every visual suite runs all
  three.
- **Templates:** all 8 (or the shipped 6+), every card suite.
- **States:** all five `?state=` values, every a11y and state suite.
- QR suites: 8 templates × 3 viewports × 6 tests = **144 QR assertions minimum**.

### 14.4 Suites, by file

```
tests/unit/resolve-card.test.ts        ordering, dangling ids (I-2), purity (I-4), bio precedence
tests/unit/build-vcf.test.ts           the §6.7 table incl. EmptyCardError, escaping, folding
tests/unit/contrast.test.ts            the contrast helper against known WCAG pairs
tests/unit/format.test.ts              phone/URL/address/mask formatters, clamps
tests/contract/tokens.test.ts          tokens.css ⟷ tokens.ts parity (AC-12)
tests/contract/contrast-sweep.test.ts  every text pair ≥4.5:1, every control pair ≥3:1 (AC-13)
tests/contract/templates.test.ts       registry exhaustive; qrZone present; backgroundSrc rule
tests/contract/field-renderers.test.ts all 21 FieldTypes have a renderer (AC-21)
tests/contract/routes.test.ts          every §6.1 row has page/loading/error files as declared
tests/contract/anti-ai-lint.test.ts    F-01…F-17 greps (AC-15)
tests/e2e/qr-geometry.spec.ts          QR-T1
tests/e2e/qr-plate.spec.ts             QR-T2
tests/e2e/qr-overlap.spec.ts           QR-T3
tests/e2e/qr-occlusion.spec.ts         QR-T4
tests/e2e/qr-scannability.spec.ts      QR-T5  ← the ground truth
tests/e2e/qr-export.spec.ts            QR-T6
tests/e2e/template-contrast.spec.ts    §8B.6 per-template rendered-pixel audit
tests/e2e/a11y.spec.ts                 axe, every route × every state (AC-25)
tests/e2e/keyboard.spec.ts             full keyboard traversal, focus ring visibility (E-48)
tests/e2e/states.spec.ts               all four families on every data screen (AC-24)
tests/e2e/edge-content.spec.ts         §11 rows E-01…E-23, E-53, E-55, E-56
tests/e2e/edge-interaction.spec.ts     §11 rows E-34…E-52, E-54
tests/e2e/eighty-twenty.spec.ts        the 80/20 pixel audit (AC-16)
tests/e2e/perf.spec.ts                 CLS, LCP, bundle assertions (N-2…N-6)
```

### 14.5 Must-never-regress list

The repo has **no pre-existing test suite** (bare scaffold), so the baseline is the toolchain
plus everything this run adds:

1. `pnpm --filter web typecheck` exits 0
2. `pnpm --filter web lint` exits 0
3. `pnpm --filter web build` exits 0
4. **QR-T1…QR-T6 green for every template × every viewport** — the single most important line
5. `tests/contract/contrast-sweep.test.ts` green
6. `tests/e2e/a11y.spec.ts` green with 0 serious/critical
7. Every previously-fixed bug retains its regression test
8. `apps/api/**`, `packages/**` and the repo-root files remain **byte-identical** — verified by
   `git status --short` showing changes only under `apps/web/` and `docs/`

### 14.6 Rules for the tester and fixer agents

- **Never weaken, skip, or delete a test to make it pass.** A failing QR-T5 means the template
  is wrong, not the assertion.
- **Never relax a contrast threshold.** §8B.6 exists specifically so a beautiful template can
  fail. When it does, the template changes.
- **Never assert geometry in jsdom/happy-dom.** It has no layout engine; `getBoundingClientRect`
  returns zeros and every such assertion is vacuously true. Geometry is Playwright-only.
- **Always `await document.fonts.ready`** before a geometry or contrast assertion.
- **`thumb` mode is exempt from scannability (§8A.5).** Failing the gallery for an unreadable QR
  is a misreading of the spec and wastes a fix round.

### 14.7 Not automatable — the manual list

- Whether `/` reads as editorial rather than generated (§8C.3 M-1).
- Whether the eight templates feel like eight products rather than eight palette swaps.
- Whether the imagery is real rather than stock-vector (M-3).
- **Actual scanning with a physical phone camera.** `jsqr` proves the symbol is *decodable*;
  only a phone proves it is *comfortable to scan at arm's length*. §17.3 makes this the first
  item on Vansh's checklist.

---
## 15. Acceptance Criteria

Every criterion is binary and every one names the command or test that decides it. The final
report is scored line by line against this list.

**Gate A — the toolchain**

```
AC-01  `pnpm --filter web typecheck` exits 0.
AC-02  `pnpm --filter web lint` exits 0 with zero errors and zero warnings.
AC-03  `pnpm --filter web build` exits 0.
AC-04  `git status --short` shows modified/created paths ONLY under `apps/web/` and `docs/`.
       Zero changes under `apps/api/`, `packages/`, `.github/`, or the repo root.
AC-05  Every route in the §6.1 manifest responds 200 (or the declared not-found panel) under
       `next start`, asserted by `tests/e2e/routes.spec.ts`; `/cards/new` resolves to the
       builder and not to `/cards/[cardId]` with cardId="new".
AC-06  Zero occurrences of `fetch(`, `axios`, `useSWR`, `useQuery`, `localStorage`,
       `sessionStorage`, `document.cookie` anywhere under `apps/web/src/**`, EXCEPT the
       untouched `apps/web/src/lib/api.ts`. Asserted by `tests/contract/anti-ai-lint.test.ts`.
       This is the machine check on the §3.1 scope wall.
```

**Gate B — the QR contract (§8A) — any failure here is P0**

```
AC-07  `CardTemplate.qrZone` is a non-optional property with no default; a template literal
       omitting it fails `tsc --noEmit`. Proved by a `// @ts-expect-error` fixture in
       `tests/contract/templates.test.ts`.
AC-08  Every fixture card's `qrPayload` is <= 60 bytes and every `slug` is <= 24 chars matching
       /^[a-z0-9-]+$/. Asserted by `tests/contract/templates.test.ts`.
AC-09  For every template x {360, 768, 1440}:
        (a) QR-T1 — the symbol's boundingBox is square and width >= 140 CSS px;
        (b) QR-T1 — the plate exceeds the symbol by >= 16px on all four sides;
        (c) QR-T2 — plate background-color alpha === 1, background-image === 'none',
            backdrop-filter === 'none', border-radius <= 4px;
        (d) QR-T2 — module/plate contrast >= 15:1 and the symbol is not inverted;
        (e) QR-T3 — no other element inside `[data-card-root]` intersects the reserved region;
        (f) QR-T4 — at most one `[data-qr-mark]`, area <= 20% of the symbol, clearance >= 2 modules;
        (g) QR-T5 — a screenshot of `[data-qr-zone]` decoded by `jsqr` returns EXACTLY
            `resolved.qrPayload`;
        (h) `mode="thumb"` renders NO decodable symbol (the deliberate exemption, §8A.5).
AC-10  QR-T6 — `exportCardPng()` output (800x1720) decodes by `jsqr` to exactly
       `resolved.qrPayload`, for every template.
AC-11  Every `full`-mode card contains exactly one `[data-qr-zone]` element (invariant I-3).
```

**Gate C — the design system**

```
AC-12  `tokens.css` and `tokens.ts` are key-for-key and value-for-value identical, asserted by
       `tests/contract/tokens.test.ts`.
AC-13  Every text-on-surface token pair used for body text measures >= 4.5:1, and every
       control-boundary pair >= 3:1, asserted by `tests/contract/contrast-sweep.test.ts`.
       `--ink-faint` (#7C8B83) appears in ZERO text-colour declarations.
AC-14  §8B.6 per-template rendered-pixel contrast audit passes for every template x viewport:
       every text node measures >= 4.5:1 against the median luminance beneath it
       (>= 3:1 where computed font-size >= 24px). `tests/e2e/template-contrast.spec.ts`.
AC-15  The anti-AI lint (F-01…F-17) reports zero violations.
       `tests/contract/anti-ai-lint.test.ts`. Specifically: zero raw colour literals outside
       `src/styles/tokens.css`; zero `font-weight > 500` outside `src/card/templates/**`;
       zero `shadow-*`/`box-shadow` outside `src/components/overlay/**`; zero `backdrop-filter`
       anywhere; zero `rounded-2xl`/`rounded-3xl` outside the sheet component.
AC-16  The 80/20 audit: on full-page screenshots of `/dashboard`, `/cards` and `/`, paper+ink
       family pixels are >= 78% and accent+signal <= 22%. `tests/e2e/eighty-twenty.spec.ts`.
AC-17  Zero CLS on `/` and `/c/[slug]` (N-4), and the card-only typefaces do not appear in the
       `/` or `(auth)` bundles (N-3). `tests/e2e/perf.spec.ts` + the build route table.
```

**Gate D — the card system**

```
AC-18  `TEMPLATES` is typed `Record<TemplateId, CardTemplate>` and contains at least 6 entries;
       all 8 if not cut per §8B.3. Every template has a product name (no digits in `name`).
AC-19  Every template's `backgroundSrc` is a resolvable path when `background` involves a photo
       and `null` otherwise. `tests/contract/templates.test.ts`.
AC-20  Every card in `full` mode renders EXACTLY TWO action buttons (§8A.2), asserted per
       template. Where no `PHONE` is mapped the WhatsApp button is absent, not disabled (E-56).
AC-21  All 21 `FieldType` members have an entry in `FIELD_RENDERERS`; omitting one fails
       `tsc --noEmit`. `tests/contract/field-renderers.test.ts`.
AC-22  `buildVcf` satisfies every row of the §6.7 table: throws `EmptyCardError` at zero fields,
       omits empty values, escapes `, ; \`, folds at 75 octets, masks financial types. The set
       of field types in the `.vcf` equals the set rendered visibly on the card.
AC-23  `resolveCard` is pure (I-4) and drops dangling ids into `droppedFieldIds` (I-2);
       a card with 0 fields yields `fieldCount === 0` and the builder blocks Save (E-01).
```

**Gate E — screens, states and accessibility**

```
AC-24  Every data screen in §8D.3 renders all four state families, each reachable via `?state=`
       and each carrying the correct `data-screen-state` attribute. The first-run empty state
       and the filtered-to-nothing empty state are DIFFERENT components with different copy and
       different actions. `tests/e2e/states.spec.ts`.
AC-25  `@axe-core/playwright` reports ZERO serious and ZERO critical violations on every route
       in §6.1 x every applicable `?state=` value x {360, 768, 1440}. WCAG 2.2 AA (Q26).
AC-26  Full keyboard traversal of the auth flow, the app shell, the builder and the public card
       page: every interactive element reachable, a visible focus ring on each, and that ring
       measures >= 3:1 against its ground on EVERY surface including accent fills and
       photographic template backgrounds. `tests/e2e/keyboard.spec.ts`.
AC-27  Under `prefers-reduced-motion: reduce`: all five duration tokens compute to 0ms, no
       scroll-driven transform occurs, the skeleton shimmer is static, and no carousel
       auto-advances. `tests/e2e/a11y.spec.ts`.
AC-28  The six auth screens each ask exactly ONE question, show a progress indicator, and offer
       a non-destructive Back on every screen except step 1. Values survive Back.
AC-29  The builder is a split view: the preview is visible without scrolling at all three
       viewports, and ticking a field / selecting a template updates it with no intermediate
       commit action. The preview object and the export payload are the same `ResolvedCard`
       reference (I-5), asserted by identity in `tests/unit/resolve-card.test.ts`.
AC-30  `/templates` renders a left category rail plus a 3-up grid (2-up at 768, 1-up at 360) of
       LIVE `<CardRenderer mode="thumb">` previews, each in a ~1:2.15 frame at `--radius-xl`,
       with the template name as a left-aligned caption BELOW the frame.
AC-31  `/` renders all nine §8D.6 sections in order; `[data-reveal]` count <= 6 with no two
       consecutive sections revealing; at most 3 sections are centred single-column;
       `src/fixtures/marketing.ts` contains none of the F-13 banned phrases.
AC-32  Zero `dangerouslySetInnerHTML` anywhere under `apps/web/src/**`; every `target="_blank"`
       carries `rel="noopener noreferrer"`. `tests/contract/anti-ai-lint.test.ts`.
AC-33  On a public card, every `BANK_ACCOUNT`, `DIGITAL_WALLET`, `CRYPTO_WALLET` and
       `isSensitive` field renders masked with no reveal control, and `LOCATION_TRACKING`
       renders no coordinate (§7.3).
```

**Gate F — edge cases**

```
AC-34  Every row of §11 (E-01 … E-56) has at least one automated test and that test passes.
       The mapping is stated explicitly in the final report.
AC-35  At 360x800, with the longest fixture name, the 25-field card and the tallest template
       simultaneously: `scrollWidth <= clientWidth` on `[data-card-root]`, no vertical overflow
       past 722px, and the QR still decodes (E-53).
AC-36  A card with zero mapped fields: the builder shows the warning bar and a disabled Save
       (E-01), and `/c/[slug]` renders no "Save to contacts" button at all (E-02). The 73-byte
       name-only vCard is UNREACHABLE through the UI.
```

**Gate G — process**

```
AC-37  Nothing was committed, staged, pushed, stashed or deployed. `git log -1` is unchanged
       from `a098b7c` and `git status --short` shows only an uncommitted working tree.
```

---

## 16. Risks, Unknowns, Assumptions

### 16.1 Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R-1** | **Scope.** This is 19 routes, ~50 components, 8 templates, a design system and ~10 test suites in one run. It is the largest thing this team has attempted. | **High** | **High** | The §3.5 cutting order is pre-agreed: marketing → gallery → PNG export → *never* cards/QR. Stage B must decompose into file-disjoint tracks so waves genuinely parallelise. If a wave stalls, cut down the order rather than degrading the card system. |
| **R-2** | **`jsqr` decoding a Playwright screenshot is flaky** — anti-aliasing, DPR, and font-load timing all perturb the raster. | Medium | **High** (a flaky P0 gate poisons every fix round) | Screenshot `[data-qr-zone]` at `deviceScaleFactor: 2` with `animations: 'disabled'`, after `await document.fonts.ready`; decode the raw PNG buffer via `pngjs` rather than a canvas re-encode; retry a decode **at most twice** and treat a third failure as real. If it still flaps, raise the symbol floor from 140px to 160px — **never** relax the assertion. |
| **R-3** | **Next.js 16 differs from training data** (`apps/web/AGENTS.md` says so explicitly). | **High** | Medium | The framework-shaped facts were verified against `apps/web/node_modules/next/dist/docs/` before writing this spec — async `params`, global `PageProps`/`LayoutProps`/`RouteContext`, `useSearchParams` needing Suspense, `next/font` `axes`. Every executor prompt must repeat: **read the bundled docs before writing App Router code.** |
| **R-4** | **The `translucent-textured` button fill (Passage) is the highest-risk visual.** A torn-edge mask plus a translucent fill plus a photographic ground is exactly the combination §8B.6 is built to fail. | Medium | Low | α ≥ 0.92 is mandated; Passage is first on the §8B.3 cut list; failing the audit means changing the template, not the threshold. |
| **R-5** | **Two-domain weight policy gets misapplied** — an executor uses `font-bold` in the app because a template used 700. | Medium | Low | F-11 is a hard grep with an explicit directory allowlist (AC-15). |
| **R-6** | **The two commercial TTFs are still sitting untracked in the repo root.** `Modern Era.ttf` (80 KB) and `TiemposHeadline-Regular.ttf` (78 KB) appear in `git status` as `??`. Q18 replaced them with free Google Fonts analogues, so **no licence exposure remains in the build** — nothing imports them and nothing ships them. But an accidental `git add .` would commit two commercial font binaries into a repo. | Low | Medium | **This is Vansh's call, not the team's.** Options: (a) delete them; (b) move them outside the repo; (c) add both filenames to `.gitignore`. **Recommendation: (c) `.gitignore`** — keeps the originals available for eyeball comparison against the Google analogues while making an accidental commit impossible. **No agent will touch these files** (§3.3). |
| **R-7** | **Eight templates that read as eight palette swaps.** The whole point of Q9's "classy" is that they are genuinely different. | Medium | Medium | The taxonomy forces real variation across seven axes (background, buttonFill, radius, icon, shadow, avatarKind, typeFamily), and §8B.3 assigns a distinct combination to each. Manual review item: do these feel like eight products? |
| **R-8** | **The `?state=` switch is mistaken for dead code** and removed by a later contributor, taking every loading/error test with it. | Low | Medium | §6.3 states its purpose; `data-screen-state` is a documented contract in §13.2; AC-24 fails immediately if it is removed. |
| **R-9** | **A11y sweep volume.** 19 routes × up to 5 states × 3 viewports is a large axe matrix and may exceed the 10-minute budget (N-7). | Medium | Low | Run axe at 360 and 1440 only for non-card routes; card routes get all three. Parallelise by Playwright project. |
| **R-10** | **Fonts swapping mid-measurement** makes geometry and contrast tests flaky in a way that looks like a real failure. | Medium | Medium | `await document.fonts.ready` is mandated in §14.6 before every geometry or contrast assertion. |

### 16.2 Open questions

| # | Question | Fallback if unanswered |
|---|---|---|
| **OQ-1** | **RESOLVED** — the template reference images arrived mid-spec and are folded into §8B. | — |
| **OQ-2** | Ship 6 templates or all 8? | **Fallback taken: build all 8**, with Passage and Almanac first on the cut list (§8B.3). |
| **OQ-3** | Do the two commercial TTFs get deleted, moved, or `.gitignore`d? (R-6) | **Fallback: leave them untouched and untracked.** No agent touches them. Vansh decides. |
| **OQ-4** | Does Vansh accept the E-01…E-04 empty-card guards, which override his Q31 deselection? (§11.6) | **Fallback: include them.** Reason stated in §11.6; removing them is one line at Gate 1. |
| **OQ-5** | Is `--radius-xl` 20px the right card-frame radius? The reference measured ~16–20px. | **Fallback: 20px.** A one-token change if wrong. |
| **OQ-6** | Should `/templates` live under `(marketing)` (public) or `(app)` (authenticated)? | **Fallback: `(marketing)`, public.** Linktree's gallery is public and it is a strong acquisition surface. |

### 16.3 Assumptions — every place I decided on Vansh's behalf

Each is tagged `[ASSUMED]` and each is cheap to reverse at Gate 1.

| # | Assumption | Why | Cost to change |
|---|---|---|---|
| **AS-01** | `[ASSUMED]` **All four state families are mandatory on every data screen**, and first-run empty ≠ filtered-to-nothing empty. | Q22 was answered "[No preference]", explicitly delegating it. | Medium — it is ~1 extra component per screen. |
| **AS-02** | `[ASSUMED]` **`ContactCard.templateId` is a new persisted field.** The old schema has no template column. **The API will need one.** | Otherwise the template choice is thrown away on save — the exact old-build bug. | Low here, but it is a **cross-boundary flag** for the API run. |
| **AS-03** | `[ASSUMED]` **`ContactCard.slug` is a new field**, ≤ 24 chars, `[a-z0-9-]`. | The public URL needs a stable, short, non-enumerable id, and §8A.6 caps the payload at 60 bytes. | Low. Also a cross-boundary flag. |
| **AS-04** | `[ASSUMED]` **The empty-card guards E-01…E-04 are included**, overriding Vansh's Q31 deselection. | It is a documented shipped production bug (§11.6). | Trivial — delete E-01…E-04 and AC-36. |
| **AS-05** | `[ASSUMED]` **The `?state=` URL switch** is how loading/error/offline states are reached and tested, and it ships in production builds. | Without it these states are unreachable and therefore untestable in a fixture-only app. | Low. |
| **AS-06** | `[ASSUMED]` **Card canvas is `400 × 860` (1:2.15), min `336 × 722`.** | Measured from the supplied references; every §8A number derives from it. | **High** — it is the geometric basis of the QR contract. |
| **AS-07** | `[ASSUMED]` **QR floor 140px, ceiling 200px, quiet zone `max(16px, 4 modules)`, ECC H, centre mark ≤ 20%.** | 140px is the practical arm's-length scanning floor; 20% leaves headroom inside ECC H's 30%. | Low — they are constants in one module. |
| **AS-08** | `[ASSUMED]` **Two-domain weight policy**: UI locked to {400, 500}; templates may go to 700 within a closed 4-family set. | Resolves the Q17 ↔ Q18 ↔ Boultont/Lane tension explicitly rather than silently (§8.4). | Low. |
| **AS-09** | `[ASSUMED]` **`--ink-muted` re-derived from `#65756D` to `#55655D`.** | The salvaged value measures **4.33:1 on `--paper`** — it fails AA. Keeping it would fail AC-13. | Trivial, and not really optional. |
| **AS-10** | `[ASSUMED]` **`--rule-control` `#8F7F66` introduced** as a separate, darker control boundary. | `--rule` `#D8CCB9` is 1.41:1 — fine as decoration, fails 1.4.11 as an input boundary. | Trivial. |
| **AS-11** | `[ASSUMED]` **Elevation: flat in flow, real elevation only in overlays** (three levels). | The old build declared elevation tokens and set them all to `none`. This picks a side and states why (§8.7). | Low. |
| **AS-12** | `[ASSUMED]` **The eight template names** — Ledger, Chapter, Foundry, Marquee, Atrium, Almanac, Terminal, Passage. | Vansh said "classy" and the reference names products, not numbers. Names are mine. | **Trivial** — a string per template. If Vansh has names, this is the easiest thing in the document to change. |
| **AS-13** | `[ASSUMED]` **Auth is simulated by an in-memory context with no route guard.** | Q5's UI-only wall; a real guard would need a session. | Trivial. |
| **AS-14** | `[ASSUMED]` **Radix + `lucide-react` + `qrcode` + `html-to-image` + `clsx`/`tailwind-merge`** as the only runtime additions; no zod, no state library, no animation library. | Q29 named Radix; the rest are the minimum to satisfy §8A and Q25. | Low. |
| **AS-15** | `[ASSUMED]` **The 80/20 split is quantified as ≥78% / ≤22% measured pixels.** | Hinge states the rule but not a number; an unmeasurable rule is not enforceable. | Trivial — one threshold. |
| **AS-16** | `[ASSUMED]` **`/templates` is public, under `(marketing)`.** | See OQ-6. | Low — a directory move. |
| **AS-17** | `[ASSUMED]` **Copy is `en-GB`**, matching the Hinge reference locale and Vansh's phrasing. | — | Trivial. |
| **AS-18** | `[ASSUMED]` **Marketing pricing shows two plans**, presentation only, CTAs → `/signin/phone`. | Q20 selected a pricing section; no plans were specified. | Low. |

---

## 17. Rollout & Review

### 17.1 Feature flags

**None.** This is a ground-up build on a feature branch (`refac-new-build`) against a bare
scaffold. There is nothing to flag off — the branch itself is the flag.

### 17.2 Exact commands

```bash
# install (Stage C will add the §9.3 packages)
pnpm install
pnpm --filter web exec playwright install chromium

# the three gates, in order
pnpm --filter web typecheck          # tsc --noEmit                        -> AC-01
pnpm --filter web lint               # eslint                              -> AC-02
pnpm --filter web build              # next build                          -> AC-03

# tests
pnpm --filter web test               # vitest run    (unit + contract)
pnpm --filter web test:e2e           # playwright test (geometry, a11y, edge)
pnpm --filter web test:qr            # playwright test tests/e2e/qr-*.spec.ts   <- the gate that matters

# run it
pnpm dev:web                         # http://localhost:3000
pnpm --filter web build && pnpm --filter web start
```

New scripts to add to `apps/web/package.json`: `test`, `test:e2e`, `test:qr`, `test:a11y`.
Existing `dev`, `build`, `start`, `lint`, `typecheck` are unchanged.

### 17.3 How Vansh verifies manually — in the order his attention pays best

1. **Scan a card with a real phone.** `pnpm dev:web` → `/c/prya-hq` → point a phone at the
   screen. Then do it for **every** template via `/templates`. `jsqr` proves the symbol is
   decodable; only a phone proves it is comfortable at arm's length. **If this fails, nothing
   else matters.**
2. **Open the empty card.** `/cards/card_empty_demo/edit` → confirm the warning bar and the
   disabled Save. Then `/c/{its slug}` → confirm "Save to contacts" is **absent**. This is the
   old build's worst bug, verified dead.
3. **Look at the eight templates side by side** at `/templates`. Do they read as eight products
   or eight palette swaps? This is the judgment no test can make.
4. **Read the marketing page as a stranger.** Does it look editorial or generated? Check the
   three §8C.3 manual items: asymmetry, no icon-chip grid, real imagery.
5. **Drive the whole app with the keyboard only.** Tab from the skip link to the builder's Save.
   Watch the focus ring on the accent-filled buttons and on the photographic templates.
6. **Walk the states.** Append `?state=loading`, `?state=empty`, `?state=error`,
   `?state=offline` to `/cards`, `/contacts`, `/profile`, `/dashboard`.
7. **Export a PNG and send it to yourself on WhatsApp**, then scan it from the received image.
   That is the real-world path for Q25.
8. **Resize to 360px** and re-check the card, the builder and the contacts table.
9. **Read the `[ASSUMED]` table (§16.3)** — that is where the team decided on his behalf and it
   is the highest-value 3 minutes of review in this document.
10. **Decide R-6** — what happens to the two commercial TTFs at the repo root.

### 17.4 The reminder

**The team does not commit, stage, push, tag, merge or deploy. Ever.** Stage C ends at a final
report and a dirty working tree. Vansh reviews the diff and commits himself (AC-37).

---
# Appendix A — Interview Transcript

The complete Stage A grilling, verbatim, in the order it happened. **32 substantive questions**
against a floor of 20. This lives here, inside the spec — never as its own file.

## A.0 Vansh's verbatim problem statement

> https://hinge.co/en-gb / https://hinge.co/en-gb/brand-resources / https://linktr.ee/s/templates
>
> "I want you to analyze all three links ... from a design perspective, as if you are a proper
> design engineer. I think it will be a full revamp. I wanted to analyze all these three links:
> the brand resources, how the templates that we'll be making will be made, the website view ...
> the auth flow, how the auth flow will be, how the templates and cards will be made, what the
> view of the card builder will be. Analyse these things and come with a spec plan analyzing all
> these things. Make sure you are analyzing all the screens, not just the auth flow: all the web
> app screens, all the marketing websites, all the system states, all the public cards. Make sure
> you are making a proper frontend screen-making guide. It should be different plan.md that will
> be made here. The design system has already been given to you. ... Just make sure each and
> every card that I am sharing with you explicitly has a QR code in it. Make sure you are making
> the design according to that itself. Each and every QR card should have a QR. ... now it's very
> high time."

## A.1 The Q&A

```
Q1  — Reference images for promotional/networking-event cards did not attach. How to proceed?
A1  — "I'll re-send the images now."  [own answer]
      Template art direction stayed OPEN through spec drafting.
      ⟶ RESOLVED MID-SPEC: the images arrived and were folded into §8B.
        Six templates supplied: Artemis, Balcombe, Boultont, Lane, Smythe Sports.

Q2  — Deliverable boundary: docs only, or build the UI?
A2  — Spec + plan + build the full UI. Stage C implements design system, all screens,
      templates and builder in apps/web.   [own answer]

Q3  — Framework target?
A3  — Next.js 16 App Router as scaffolded (React 19, Tailwind v4). SSR for public cards and
      marketing SEO.   [accepted recommendation]

Q4  — How closely to track Hinge's brand identity?
A4  — Borrow the SYSTEM, not the SKIN. Hinge's structure (near-mono 80/20 palette discipline,
      editorial-serif + friendly-sans pairing, restraint, one-question-per-page) but Contact
      Book's own colour and typefaces. Legally safe, visually distinct.   [accepted recommendation]

Q5  — What is the frontend building against (backend)?
A5  — VERBATIM: "Our work is to just make the Ui nothing else API integration will be doing at
      last."   [own answer]
      ⟶ UI ONLY. NO API integration. No data-fetching layer. Everything driven by typed
        fixtures. This is a hard scope wall (§3.1).

Q6  — Which surfaces in scope? (multi-select)
A6  — ALL FOUR — (1) Design system + component library, (2) Auth flow one-question-per-page,
      (3) Web app screens, (4) Card templates + card builder + public card pages.   [own answer]

Q7  — Marketing site: build it, and where?
A7  — VERBATIM: "See Marketing website will be just a normal one page scrollable website with
      different section not a very big headache but from the Ui perspective it should be the
      best modern but it should not look AI made."   [own answer]
      ⟶ Single scrollable page, multi-section, in apps/web under a (marketing) route group.
        MUST NOT LOOK AI-MADE — treated as an explicit anti-pattern list (§8C), not a vibe.

Q8  — Palette direction?
A8  — Warm paper + deep green, purple-free. Ground ~#F7F1E6 warm paper, near-black ink, single
      accent deep green ~#0E5F4F (already present in origin/main theme-preview-page.tsx).
      Reads premium, distinctly non-Hinge, QR-safe at high contrast.   [accepted recommendation]

Q9  — How many card templates?
A9  — VERBATIM: "We just need to ship 6-8 templates but all those should be classy."   [own answer]
      ⟶ 6–8 named templates. Quality over quantity. Each gets real art direction, not a
        palette swap.

Q10 — Card builder interaction model?
A10 — Split view — live card preview pinned one side, template/fields/theme controls the other,
      everything live. (Linktree model. decision-context.md records the old stepped wizard
      failing precisely because it hid the result until the end.)   [accepted recommendation]

Q11 — What does the public card page show after a QR scan?
A11 — Themed card rendering the card's own template + primary "Save to contacts" (.vcf) +
      secondary "Message on WhatsApp". Matches the locked four-pillar scope.   [accepted recommendation]

Q12 — Where does the QR live on a card?
A12 — A PROTECTED QR ZONE every template must honour. Fixed reserved region, guaranteed contrast
      plate, >=4-module quiet zone, >=140px, ECC level H. Themes decorate AROUND it, never over
      it. Enforced as a lint/validation rule in the template schema.   [accepted recommendation]

Q13 — Typefaces?
A13 — "I have added the ttf file for both of the fonts use that."   [own answer]
      FINDING: ./Modern Era.ttf and ./TiemposHeadline-Regular.ttf exist at repo root. BOTH ARE
      SINGLE STATIC REGULAR 400. No Light, no Medium, no Bold, no variable axes.
      Modern Era: 565 glyphs, 1000 upem. Tiempos Headline: 438 glyphs, 1000 upem.
      Hinge's own system requires Tiempos Light + Modern Era Regular/Medium/Bold — not
      expressible with these files.

Q14 — Auth step sequence?
A14 — Phone (+ countryCode) -> OTP -> First name -> Last name -> Email -> Done. Six screens, one
      question each, progress indicator, back always available. Matches the verified API contract
      in origin/main decision-context.md.   [accepted recommendation]

Q15 — Which authenticated app screens? (multi-select)
A15 — Dashboard + Cards list + Card detail/builder; Contacts list + Contact detail.
      (Initially EXCLUDED Profile/field-groups and Settings/Privacy/Share-history — see Q19.)

Q16 — Responsive priority?
A16 — Mobile-first for cards/public surfaces (QR is scanned on phones), desktop-first for the app
      (builder split-view and contacts tables need width).   [accepted recommendation]

Q17 — Only Regular 400 available; how to build hierarchy?
A17 — One-weight editorial system — hierarchy from size, leading, tracking, colour and case
      rather than weight. Single-weight typography is a strong signal a page was not
      AI-generated.   [accepted recommendation]

Q18 — Commercial licence exposure on Tiempos/Modern Era?
A18 — VERBATIM: "See instead of the licent font take a look over google fonts and fontsn which
      are relabtable to the current one use them for the max similarity."   [own answer]
      ⟶ Swap to free Google Fonts analogues chosen for maximum similarity. Resolves BOTH
        licensing and the missing-weights problem.
      TENSION NOTED: Q17 chose a one-weight system because only 400 existed; free analogues are
      variable. RESOLUTION: keep one-weight editorial DISCIPLINE as an aesthetic rule (it defeats
      the AI look) while real weights remain available for dense UI. Flagged, not silently
      decided.  ⟶ Finalised in §8.4 as the two-domain weight policy after the reference images
      showed Boultont's bolder name and Lane's separate display family.

Q19 — CONTRADICTION CHALLENGED: Cards+Contacts in scope but Profile/field-groups excluded, yet a
      card is only a filter over ProfileFields, so cards would render name-only.
A19 — Add Profile + field groups to scope.   [own answer]
      (This is the exact bug decision-context.md records from the old build: card 5a286f9e had
      0 field mappings and produced a 73-byte name-only .vcf.)

Q20 — Marketing sections? (multi-select)
A20 — ALL — Hero + how-it-works + template showcase; the QR/scan demo section; social proof +
      FAQ; pricing + final CTA + footer.   [own answer]

Q21 — Which free analogue pair?
A21 — Newsreader (editorial serif, variable, optical sizing — closest free analogue to Tiempos
      Headline) + Hanken Grotesk (friendly large-x-height grotesk — tracks Modern Era). Both
      Google Fonts, both variable, both under-used.   [accepted recommendation]

Q22 — Which system states per data screen? (multi-select)
A22 — "[No preference]" -> planner decides, tag [ASSUMED].
      DECISION: all four families mandatory per data screen — loading skeleton (layout-matched,
      not spinners), empty/first-run (distinct from filtered-to-nothing), error/offline (incl.
      partial failure + retry), success/confirmation.   [ASSUMED — see AS-01]

Q23 — Dark mode?
A23 — Light only, done properly. (origin/main faked it: .dark merely mirrored light — a big
      reason the old theme felt unresolved.) Warm-paper + deep-green is a light-mode idea that
      loses identity inverted; also keeps QR contrast predictable.   [accepted recommendation]

Q24 — Testing bar for a UI-only run?
A24 — tsc --noEmit clean + next build passes + automated a11y/contrast checks on every template
      + programmatic QR-scannability checks (quiet zone, min size, contrast) per template.
      [accepted recommendation]

Q25 — Card output formats beyond on-screen? (multi-select)
A25 — Shareable image (PNG) for social/WhatsApp. (Print-ready PDF, lock-screen format NOT
      selected -> v2.)   [own answer]
      ⟶ Card must be built as an exportable node, not merely DOM.

Q26 — Accessibility bar?
A26 — WCAG 2.2 AA on app AND public cards. Keyboard operable, visible focus, 4.5:1 text contrast,
      labelled controls, respects prefers-reduced-motion. Template contrast checked
      automatically.   [accepted recommendation]

Q27 — What gets cut first if Stage C must cut?
A27 — Cut the marketing site first. NEVER cut cards/QR — the card system, builder and public card
      page are the product.   [accepted recommendation]

Q28 — Run controls?
A28 — Nowhere until the final report. Fully autonomous Stage C. max_rounds = 5. Interrupt only
      for a genuine PROTOCOL §7 blocker. Vansh reviews the working tree and commits himself.
      [accepted recommendation]

Q29 — Component foundation?
A29 — Radix primitives for behaviour (dialog, popover, select, tabs — focus management + ARIA
      solved) with 100% of the visual layer written against our own tokens. Explicitly NOT
      shadcn's default look, which is part of the AI fingerprint.   [accepted recommendation]

Q30 — App navigation shell?
A30 — Left sidebar, warm paper, collapsible. 240px rail (Dashboard, Cards, Contacts, Profile),
      collapses to icons, becomes bottom bar on mobile. Matches origin/main
      --sidebar-width: 240px.   [accepted recommendation]

Q31 — Content extremes to survive? (multi-select)
A31 — SELECTED — very long names/job titles/company names (40+ chars); missing avatar / no photo
      / broken image.
      NOT selected — non-Latin/RTL/emoji; card with 1 field vs 25+ fields.   [own answer]
      PLANNER NOTE: the 1-field-vs-25-fields case is a DOCUMENTED PRODUCTION BUG in
      decision-context.md (empty cards ranked first as presets, produced name-only vCards).
      Include an empty-card guard anyway, tagged [ASSUMED], and surface it at Gate 1.
      ⟶ Done: §11.6, E-01…E-04, AS-04, AC-36. The override is stated openly.

Q32 — Motion policy?
A32 — Editorial motion on marketing (real scroll-driven moments for template showcase + QR demo),
      calm in-app. Respect prefers-reduced-motion throughout. No scroll-jacking.
      [accepted recommendation]
```

## A.2 Post-interview input (arrived after Q32, during spec drafting)

**Template reference images — six Linktree templates supplied by Vansh, analysed and folded
into §8B, §8A.1 and §8C.** Artemis, Balcombe, Boultont, Lane, Smythe Sports. They resolved Q1
and superseded the previously-`[ASSUMED]` art direction. Three findings changed the spec:
the card canvas is **1:2.15**, not 3:4 (§8A.2); **none of the six contains a QR**, forcing the
deliberate two-button divergence (§8A.2); and **two of the six fail WCAG AA on button text**,
forcing the per-template rendered-pixel contrast audit (§8B.6).

## A.3 Accounting

**Question count:** **32 substantive questions**, against a hard floor of 20.

**Blocks covered:** 1 (problem/scope), 2 (goals/non-goals), 3 (users/journeys), 4 (domain/data),
5 (interfaces), 6 (design system), 7 (accessibility), 8 (responsive), 9 (states), 10 (motion),
11 (edge cases), 12 (non-functional), 13 (testing), 14 (dependencies), 15 (risk), 16 (assumptions),
17 (rollout), 18 (run controls).

**Mandatory blocks 1, 2, 11, 13, 16, 18 — all exhausted.**

**Blocks pruned:** 3 — *auth/permissions* (Q5 removed the surface), *storage/migrations*
(no persistence exists), *observability/telemetry* (NG7; reduced to the §13 error-surface
treatment).

**Contradictions challenged:** 2.
- **Q19** — Cards + Contacts were in scope while Profile/field-groups were excluded, but a card
  is only a filter over `ProfileField`s, so every card would have rendered name-only. Vansh
  resolved it by adding Profile to scope.
- **Q17 ↔ Q18** — a one-weight system was chosen *because* only weight 400 existed; the next
  answer replaced those fonts with variable analogues, dissolving the reason. Surfaced rather
  than silently resolved, and finalised in §8.4 once the references added a third data point.

**Answered from the codebase instead of asking (these did NOT count toward the floor):**

| Fact | Source read |
|---|---|
| Next 16.3.1 / React 19.2.8 / Tailwind v4 / TS strict / pnpm 11.13.1 | `apps/web/package.json`, `apps/web/tsconfig.json`, `pnpm-workspace.yaml` |
| `LayoutProps<"/">` is a Next-16 generated global, not `React.PropsWithChildren` | `apps/web/src/app/layout.tsx` |
| `params` is a `Promise`; `PageProps`/`LayoutProps`/`RouteContext` need no import | `apps/web/node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`, `.../03-file-conventions/page.md` |
| `next/font/google` — variable fonts need no `weight`; extra axes via `axes: [...]`; `variable`, `display`, `fallback`, `adjustFontFallback` options | `.../01-getting-started/13-fonts.md`, `.../02-components/font.md` |
| **Newsreader** (`opsz 6–72`, `wght 200–800`) and **Hanken Grotesk** (`wght 100–900`) are both present in this build's font data — as are **Archivo** (`wdth 62–125`) and **Bricolage Grotesque** (`opsz/wdth/wght`) | `apps/web/node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` |
| Tailwind v4 CSS-first config via `@import "tailwindcss"` + `@theme inline` is already wired | `apps/web/src/app/globals.css`, `apps/web/postcss.config.mjs` |
| Route groups `(name)` are omitted from the URL and may carry their own layout | `.../01-getting-started/02-project-structure.md` |
| `apps/web/src` is a bare 4-file scaffold; `apps/api/prisma/schema.prisma` has zero models; `docs/` was empty | direct filesystem read |
| The salvaged warm palette (`#F7F1E6` … `#0E5F4F` … `#65756D`) and `--sidebar-width: 240px` | `git show origin/main:apps/web/src/pages/theme-preview-page.tsx` |
| **`#65756D` measures 4.33:1 on `#F7F1E6` — it FAILS AA.** Re-derived to `#55655D` (5.48:1) | computed, not assumed — see §8.3 and AS-09 |
| Two commercial TTFs sit untracked at the repo root | `git status --short`, `ls -la` |
| `apps/web/AGENTS.md` warns Next 16 differs from training data and is machine-regenerated | `apps/web/AGENTS.md`, `apps/web/CLAUDE.md` |

**Exit criteria — every box checked:**

- [x] 20+ substantive questions asked and answered (32)
- [x] Mandatory blocks 1, 2, 11, 13, 16, 18 exhausted
- [x] Problem, goals, non-goals each stated unambiguously (§1, §2)
- [x] Scope walls explicit, including the do-not-touch list (§3.1, §3.3)
- [x] Every entity, field and relationship specified (§5)
- [x] Every interface has concrete input/output examples including error shapes (§6.7, §6.10)
- [x] Edge cases are a table, not a sentence (§11 — 56 rows)
- [x] Acceptance criteria individually binary and testable (§15 — 37 criteria)
- [x] Testing strategy names runner, weighting and never-regress list (§14)
- [x] Dependency-down behaviour defined for every external dependency (§9.4)
- [x] Every assumption tagged `[ASSUMED]` (§16.3 — 18 items)

---

**END OF SPEC.** Nothing was committed, staged or pushed in the writing of this document.

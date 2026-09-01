# DECISION — the marketing route adopts the "Micro" direction, superseding §8C

- **Date:** 2026-08-24
- **Scope:** `src/app/(marketing)/**`, `src/components/marketing/**`, `src/styles/marketing.css`
- **Authority:** Vansh, in session, supplying a full `design.md` ("Micro") with the
  instruction to "follow this whole design.md strictly and make the marketing website
  exactly as it's being instructed", and separately: *"this will be very different from the
  inside dashboard that we have."*
- **Status:** active. Supersedes spec §8C for the marketing route ONLY.

> ⚠ **If you are writing T28, T29, T30 or T31, read this before asserting anything about `/`.**
> T30 in particular (`tests/contract/anti-ai-lint.test.ts`) is specified as a direct encoding
> of §8C.1, and §8C.1 now contradicts the design the marketing route is built to. Writing it
> from the spec as-is will fail a page that is correct.

---

## 1. What changed, and why it had to

The spec's §8C ("ANTI-AI-LOOK RULES") was derived from the Hinge reference. That reference has
since been **rejected outright** for this product — the cream/serif/near-mono system it implies
lost its argument with the card palettes, and the project's design direction was re-locked
around white app chrome plus committed per-card colour. §8C's *aesthetic* clauses outlived the
reference that justified them.

`design.md` is a different and now-authoritative direction for the marketing site specifically:
a sunrise gradient hero, a chunky editorial display face over a neutral workhorse, pastel wash
feature blocks, bordered-and-gently-shadowed cards, radii at 8/14/18px.

Several §8C clauses are direct negations of it. These are the collisions, and how each resolved:

| §8C rule | design.md requires | Resolution |
|---|---|---|
| **F-04** no `gradient` outside `src/card/templates/**` | the blue→teal sky is *the* signature visual | **Overruled for marketing.** Confined to one CSS class, `.mk-sky`, used by `hero.tsx` only. |
| **F-09** no `shadow-*` / `box-shadow` outside overlays | bordered cards and a floating product mockup | **Overruled for marketing.** Confined to `[data-mk-elevation="card"|"float"]` — attribute-driven, exactly as `tokens.css` already does for `[data-elevation]`. Two shadows exist; nothing declares its own. |
| **F-10** no `rounded-2xl` / `rounded-3xl` | radii at 14px and 18px | **Satisfied without conflict.** Named tokens (`rounded-mk-row`, `rounded-mk-block`) are used instead of Tailwind's t-shirt names, so the literal strings never appear. |
| **F-11** no `font-weight > 500` outside card templates | display face at 700–900 | **Overruled for marketing.** A 72px editorial serif at weight 500 is not the typeface. Weights are named by role (`font-mk-editorial` = 750) rather than by `font-bold`. |
| **§8C.2** hero CTA is a *text link*, never a filled button | a Dark Filled + White Filled button pair | **Overruled.** The text-link CTA was Hinge's device, and Hinge is the rejected reference. |
| **§8C.2 / F-16 / F-17** hero left-aligned, ≤3 centred sections | "the only centered text is the hero headline and section H1s" | **Partially overruled.** The hero is centred, per design.md. Everything below it is left-aligned and asymmetric, so exactly **two** sections compute to centred (`hero`, `start`) — inside §8C's own budget of three. |
| **F-01** no colour literals outside `tokens.css` | — | **Honoured, relocated.** Marketing colour lives in exactly one new file, `src/styles/marketing.css`. No component carries a literal. |

### Rules that were KEPT, because they are about quality rather than aesthetics

These still hold on `/` and should still be asserted:

- **F-02** no `Instrument Serif` + `Inter` (the default generated pairing). Also why the display
  face is Fraunces rather than Playfair Display — see §3.
- **F-03** no purple/violet/indigo/fuchsia as a brand accent. (Lavender exists as one of four
  pastel *wash grounds*; it is not an accent and carries no text colour.)
- **F-05** no glassmorphism, no `backdrop-blur` / `backdrop-filter`, anywhere.
- **F-06 / M-2** no 3-up grid of icon-in-a-rounded-tinted-chip cells.
- **F-07 / F-08** no emoji, no arrow glyphs, no "Powered by AI"-style badge.
- **F-12** ≤6 `[data-reveal]`, never on consecutive sections; exactly 2 `[data-scroll-moment]`.
- **F-13** the ten banned marketing phrases, grepped over `src/fixtures/marketing.ts`.
- **F-14** no shadcn markup; Radix primitives only.
- **F-15 / M-3** real product renders, not stock vectors or screenshots. **Strengthened**: the
  hero, the card section and the template strip all mount live `<ShareFace>` / `<CardPage>`.
- **§8.8** no `<svg>` inside `<main>` outside a card root. Kept, and it is load-bearing — it is
  why the assistant section draws its constellation with hairline `div`s and why the FAQ's
  toggle is a text `+`.
- **G2 / AC-16** the contrast bar. **Strengthened** — see §2.

---

## 2. Contrast: design.md's own palette does not pass, and was re-derived

This is the most important thing in this document. **The hues in `design.md` are the brand and
are reproduced unchanged. Its contrast pairings are wrong and were not.** Measured against its
own `#f5f5f5` canvas:

| design.md value | its stated role | measured | verdict |
|---|---|---|---|
| Stone Gray `#797267` | "secondary text, muted body copy" | **4.36:1** | fails AA body |
| Pebble `#8c8a88` | "tertiary text" | **3.15:1** | fails AA body |
| Azure Action `#518bdb` | "focused links", + `#f5f5f5` text on it for the primary CTA | **3.18:1** / white on it **3.46:1** | fails as text, fails as a filled CTA |
| Teal Pulse `#36bab8` | "teal text accent for links, tags" | **2.17:1** | fails badly |
| Coral `#ed6d68`, Amber `#e5a057`, Orchid `#bf89cd` | "text accent" | 2.76 / 2.03 / 2.51:1 | all fail |
| white on the hero sky | the hero's specified type colour | **3.46:1 → 2.37:1** across the ramp | fails even large-text |

Resolution, following the method the card palettes already use (hues by eye, every level found
by search — `scratchpad/mk-gen.mjs`, `scratchpad/mk-sky.mjs`):

1. **Every hue is split into two levels.** A *display* level (design.md's literal hex) for
   fills, icons, borders and decorative bands, at the 3:1 non-text bar; and a derived *ink*
   level for whenever that colour carries body text, at 4.5:1. This is the same two-level
   pattern `tokens.css` already uses for `--ink` vs `--ink-4` and `--line` vs `--line-control`.
2. **The primary CTA is Ink Black, not azure.** design.md's own component list names the Dark
   Filled Button as the primary action on light grounds (16.40:1); its quick-reference
   contradicts itself by suggesting an azure fill. The component list is right.
3. **The hero sky is kept byte-for-byte and the type is inverted to Ink Black.** Sampled at 11
   points across the ramp, Ink Black's worst case is **4.74:1** — it passes body text
   everywhere. Deepening the stops until white worked was tried and rejected: it yields a
   muddier `#3075d4 → #268382` *and still fails* body text for ink at 3.56:1. Keeping the exact
   sky and inverting the type is the only option that preserves the brand and passes AA — and
   dark-on-bright is markedly less generic than white-on-gradient.
4. **The four pastel washes impose one substitution rule.** Ink measures 13.74–14.53:1 on all
   four, but `--mk-stone` measures **3.99–4.21:1** — so body copy inside a wash must be
   `--mk-ink`. Sections on a wash ground (`broadcast`, `trust`'s panels, `start`) are written
   to that rule and it is worth an assertion.

**For T28:** the `/` route should be audited against `marketing.css`'s `:root`, not against
`tokens.css`. Every ratio claimed in that file's comments is computed and re-derivable.

---

## 3. Typefaces

`design.md` names perfectlyNineties (display) and haffer (UI). **Neither is licensed to this
repository**, and the previous build shipped two licensed faces (Tiempos, Modern Era) sitting
loose in the repo root before they were deleted. That is not being repeated. `design.md`
anticipates this and names substitutes for both.

- **Display → Fraunces**, loaded route-scoped in `(marketing)/layout.tsx`. A variable serif
  built on exactly the 70s/80s reference design.md describes, with the 400–900 range it asks
  for. Chosen over design.md's nominated `Playfair Display 900` because Playfair is — with
  Instrument Serif — one of the two faces F-02 exists to keep off this codebase. Swapping is a
  one-line change in `marketing.css`.
- **Body → Geist**, named in design.md's own substitute list, already loaded by the root layout.
  So the marketing route adds **one** font request, and body copy is metrically identical either
  side of signup.

**For T28's bundle assertions:** AC-17 says the two card-only typefaces must not appear in the
`/` bundle. Still true. Fraunces is a *third* face and is `(marketing)`-scoped — it must not
appear in any `(app)` or `(auth)` bundle, which is a new assertion worth adding.

---

## 4. Section inventory changed

`MARKETING_SECTION_IDS` went from 9 to 12, and the old list is not recoverable by renaming.

**Was:** `hero, how-it-works, templates, scan, voices, fields, faq, pricing, start`
**Is:** `hero, problem, how-it-works, card, broadcast, assistant, templates, fields, trust, faq, pricing, start`

Why, in one line each:

- **`voices` deleted.** It held three invented testimonials. Fabricated social proof is the
  fastest way to lose the trust this page exists to build, and it is the one thing on a landing
  page a reader can neither verify nor forgive. There is no testimonial section and there should
  not be one until there is a real quote.
- **`broadcast` and `assistant` added.** Two of the product's four locked pillars — the opt-in
  update broadcast and the WhatsApp assistant — had **no section at all** on the old page.
- **`problem` and `trust` added.** The wedge (a saved contact is a dead copy) and the privacy
  mechanics. Both are trust content, which is the stated purpose of this pass.
- **`scan` → `card`.** It showed only the QR; it now shows both card objects, which is what the
  two-variant architecture actually is.
- **`how-it-works`, `templates`, `fields`, `faq`, `pricing`, `start` kept**, ids unchanged.
  `how-it-works` and `pricing` are the two anchors `PillNav` and `SiteFooter` link to, so those
  ids are a chrome contract and were preserved deliberately.

`tests/e2e/marketing.spec.ts` was updated in the same pass. The assertions that changed are the
ones encoding the overruled §8C clauses (hero alignment, hero CTA treatment, the section list,
the source-level `gradient`/`shadow-`/`font-semibold` greps). Everything else was kept.

---

## 5. The layering boundary, and how to test it cheaply

There are now **three** colour systems, and the marketing one is namespaced so the boundary is
one grep rather than a review:

1. app chrome — `src/styles/tokens.css`
2. card palettes — `src/card/template-palettes.ts` (per-card data, inline custom properties)
3. **marketing — `src/styles/marketing.css`, every token `--mk-*`, every utility `mk-*`**

Two assertions worth adding to T30, both three lines:

- An `mk-` utility appearing **outside** `src/components/marketing/**` and `src/app/(marketing)/**`.
- An app-chrome utility (`text-ink`, `bg-surface`, `border-line`, `text-h1`, …) appearing
  **inside** those directories. Careful: `text-mk-ink` must not match `text-ink` — anchor the
  match on a whole utility.

⚠ One further trap, already hit once and worth a test of its own: marketing components must use
`mkcn` from `src/components/marketing/mk-cn.ts`, **not** `cn` from `@/lib/cn`. `cn` is
`twMerge(clsx(...))`, and `twMerge` cannot infer a custom scale — it filed `text-mk-display` as a
*colour*, saw it conflict with `text-mk-ink`, kept the last one and silently dropped the font
size. Every headline on the page rendered at the inherited 15px, in the markup, with the CSS rule
present. `mk-cn.ts` declares the four `mk-` class groups. **The same latent bug exists in the app
for `text-h1` vs `text-ink`** — worth fixing there separately, with the app's own tests running.

---

## 6. Second-pass changes (same day), and what they mean for the tests

The eleven sections were built in parallel and then refactored once more after a system-level
review. Four of those changes alter something a test asserts:

**a. The template strip is keyed on COLOUR, not on template.**
It rendered `TEMPLATE_ORDER` — two cards — which left most of a full-bleed rail empty and
illustrated the sentence "two templates, nine colours" with no evidence of the nine. It now
renders `PALETTE_ORDER`: nine cards, same person, same template, same fields, nine grounds.
That is also the axis `/templates` presents on, and the strip is a trailer for that page.
⚠ `marketing.spec.ts` now counts `PALETTE_ORDER.length`, not `TEMPLATE_ORDER.length`.

**b. A new type step, `--mk-text-heading-xl` (36 to 60px).**
The scale had a hole. `broadcast` — the page's second most important sentence — had only the
section step (48px, identical to every other head) or the display step (72px, which is the
hero's and makes a mid-page band the largest type on the page). `<Heading size="xl">` is that
step, and it is for **one** section; a second would put two competing headlines on the page.

**c. `mk-rail-inset`, and the scroll-snap trap inside it.**
The bleed rail's first cell must line up with the section heading above it. Padding alone does
not do that: the cells are scroll-snap targets, and `scroll-snap-align: start` snaps to the
*scrollport* edge, which sits inside the padding box — so the browser scrolled the rail by
exactly the padding to satisfy the snap and `scrollLeft` sat at 152 on first paint, with the
computed `padding-left` reading a correct-but-useless 152px. `scroll-padding-inline-start` has
to carry the same value, which is why both live in one rule.

**d. `tests/stubs/next-font-google.ts` + an alias in `vitest.config.ts`.**
`next/font` is a compile-time API. The moment `(marketing)/layout.tsx` started loading a
display face, every test rendering that layout died at import with `Fraunces is not a function`.
⚠ `vi.mock` in `tests/setup.ts` does **not** fix this — mock registration is hoisted per test
file, not globally from a setup file. A resolve alias does. **Adding a typeface to any route
means adding a line to that stub**; named ESM exports must exist statically, so it cannot be a
Proxy.

### The ground and rule cadence is now central, and it is fragile

A rule is drawn **only where the section above shares this one's ground**. The first pass set
`ruled` on nine of twelve sections while alternating the ground on almost every band, so every
boundary carried both devices at once — which is the definition of a metronomic page. The
cadence is now:

| # | section | ground | ruled |
|---|---|---|---|
| 1 | hero | paper | — |
| 2 | problem | paper | ✓ |
| 3 | how-it-works | paper | ✓ |
| 4 | card | white | — |
| 5 | broadcast | peach | — |
| 6 | assistant | paper | — |
| 7 | templates | paper | ✓ |
| 8 | fields | white | — |
| 9 | trust | paper | — |
| 10 | faq | paper | ✓ |
| 11 | pricing | paper | ✓ |
| 12 | start | lavender | — |

Changing one section's `tone` breaks the cadence for its neighbours, not just for itself.

### Each band has an assigned grid figure, and it is assigned centrally

Seven of eleven bands had converged on the same 12-track "narrow head / one air column / wider
right block" figure, with the ratio 5/air/6 repeated verbatim four times. Eleven agents each
solving the layout well independently is exactly how a page ends up looking generated. The
figures are now deliberately distinct:

| section | figure |
|---|---|
| hero | centred full-bleed stack, mockup crossing the horizon |
| problem | 5 / air / 6 essay split + a 3-up numeral row |
| how-it-works | full-width head, four-up row beneath |
| card | two-up object comparison at 5 : 7, adjacent |
| broadcast | oversized full-width head, one wide argument column, 3-up guarantees at the foot |
| assistant | full-width head, full-width offset constellation |
| templates | full-width head, bleed rail past the gutter |
| fields | full-width head, full-width multi-column index |
| trust | full-width head, 7/5 → 5/7 pinwheel of wash panels |
| faq | narrow head 4 / accordion 7 |
| pricing | two columns split by one rule |
| start | centred close |

⚠ `card`'s 5-track floor is **arithmetically forced** and must not be "simplified": a rigid
336px `<ShareFace>` overflows a 4-track cell at the 1024 breakpoint. Every other ratio is free.

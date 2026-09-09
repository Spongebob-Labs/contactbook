# Design — Contact Book

<!-- Written at finish, from the built world, not before it. -->

The marketing site and the product are **two rooms on purpose**. This file documents the
marketing world. The app's own chrome is a separate, near-monochrome system in
`apps/web/src/styles/tokens.css`.

**There are two colour systems, not three, and that is the correction this build made.**
Marketing used to carry its own hues on top of the app chrome and the card palettes. It does
not any more: every colour on `/` is one of the nine card grounds in
`apps/web/src/card/template-palettes.ts`. What marketing still owns is a *layer* — the `--mk-`
namespace, its own type scale and tracking, its own measures, the deck, the motion grammar.
A shared palette is not a merged system, and the `--mk-` boundary below is unchanged.

## ⚠ SUPERSEDED IN PART — 2026-09-08, THE CLIENT'S WEBSITE BRIEF

The client sent a written website brief and a voice note, plus the original 2018 investor deck.
The homepage is being rebuilt against them. **Four things this document states as settled are
no longer true**, and each is marked at its own section below. Read this list first, because
three of the four reverse a decision that has its own long rationale further down.

| what changed | was | now |
|---|---|---|
| **The canvas** | `--mk-paper #F5F5F5`, ruled | `#FFFFFF`, plain. Nothing renders `.mk-ledger`. |
| **The hero** | type-only on a ruled sheet, no object | type left, an **animated card** right |
| **The structure** | eight inset passes overlapping by 44px | flat, full-bleed sections; white and a green wash alternating |
| **The palette** | two systems: app chrome + nine card grounds | **three** — the brand green joins them, as a five-level ladder |

### The page is seven sections now, and ten components were deleted

Stages 3 and 4 of `plan.md`, 2026-09-08. The homepage is the client's own argument, in order,
and **nothing from the previous structure survived as a section**:

| section | ground | what it is |
|---|---|---|
| `hero` | white | type left, the animated card right |
| `problem` | wash | the deck's before/after, rebuilt — a native contact with three fields struck out beside the same person's live card |
| `solution` | white | an exhibit: press a card, the profile dims to the fields it carries |
| `cards` | wash | six of the product's own nine grounds |
| `how-it-works` | white | five numbered rows, and the page's one deliberately quiet stretch |
| `belief` | wash | type, no object |
| `start` | deep green | the only dark surface, and the only centred one |

Deleted, not refactored: `broadcast`, `trust`, `faq-accordion`, `handover-flow`, `bento`,
`demo-cells`, `card-studio`, `problem`, `step-list`, `final-cta`. Where each argument went is
recorded in `fixtures/marketing.ts`'s header — the two that matter are that **`trust` was the
brief's Solution section under a different name, three screens too low**, and that
**`broadcast` was a rebuttal delivered before the claim**, so a visitor met the caveat before
they knew what the product did.

⚠ **`<Section>`'s tone union is three grounds and the migration shims are gone.** `paper`,
`clay`, `pistachio`, `periwinkle`, `amber` and `ink` survived one build as aliases so that
un-rewritten sections kept compiling; every one of those sections has now been rewritten or
deleted, so the aliases went with them.

⚠ **`mk-heading-xl` WAS MISSING FROM `mk-cn.ts` AND IT COST A SECTION.** `--text-mk-heading-xl`
was bridged in `marketing.css`, so the utility shipped — but unlisted in the font-size group,
twMerge filed it as a colour, and beside `text-mk-white` it dropped the SIZE: the close's
headline rendered at the inherited 18px, smaller than its own paragraph, with both classes
present in the markup. `final-cta.tsx` had carried a comment about routing *around* this, which
kept the workaround alive and the cause in place. The cause is fixed, and
`marketing.spec.ts` now measures every `text-mk-*` utility against the token it names, so the
whole class of bug is guarded rather than that one instance.

### The hero's card is the product's own QR pass, and it flips — 2026-09-09

The client's note, on seeing the first build: the card in the hero should be **the QR version the
dashboard already ships**, and it should **turn over** to show the card that QR opens. The
example-cards section should show the same QR design, and nothing else.

So both surfaces now render the product's own components:

| surface | what it renders | mode | symbol |
|---|---|---|---|
| hero, front face | real `<ShareFace>`, 336×500 | `full` | 173px — a real, decodable code |
| hero, back face | `<ContactCard>` filling the same box | — | none |
| `cards` section | six real `<ShareFace>`, one per palette | `thumb` @ 300 | real, under the 140px floor by design |

⚠ **"NO QR IN THE HERO" WAS A STANDING RULE AND IT IS GONE.** The argument for it was sound: the
pass's symbol has ONE pixel of clearance over `MIN_QR_SIZE_PX`, and a transform on an ancestor
spends headroom that does not exist — which is why the hero's card used to be a bespoke
rendition. A flip is exactly such a transform. The constraint did not disappear, it moved into
the flip's design:

  · **`rotateY` alone.** No scale, no perspective change mid-flight, no filter. Both faces rest
    at an identity-equivalent transform, so the resting symbol is the size it was authored.
  · **No `will-change`.** It is the obvious thing to reach for on a 3D transform and it is wrong
    here — it pins a cached raster of a mid-flight frame and leaves a soft QR on a card nobody
    is touching.
  · **Measured, not asserted in prose.** `qr-scannability.spec.ts` now DECODES the hero's symbol
    through `transform-style: preserve-3d` at all three viewports. That is a stronger guard than
    banning the component was.

⚠ **A press stops the automatic cycle for good.** A QR is a scanning target, and a code that
turns away after four seconds cannot be scanned by somebody reaching for their phone. The flip
demonstrates that there are two faces; the first interaction hands control over permanently.

⚠ **One person, and it is `FIXTURE_DB.user`.** A real `<ShareFace>` takes its identity from the
resolved card, so the hero's front face shows whoever the fixture user is — which forced the
animated back face and the problem section's before/after onto the same person. `marketingUser`
in the marketing fixture is that user with a **shorter surname** (the face clamps the name to one
line by design, and "Raghunathan" ellipsised) and **no avatar** (the portrait PNGs are silhouette
placeholders; `null` falls back to the monogram, which is shipped behaviour).

⚠ **Two bugs worth remembering, both found by measuring rather than looking.**
  · A `<button>` sets `text-align: center`, and it cascaded into the card — every label and value
    on the back face came out centred, with nothing wrong in the card's own stylesheet.
  · `.mk-flip-face[data-side="back"] > .mk-live-frame` used a CHILD selector, but `<LiveCard>`
    wraps the card in a `<figure>`, so it matched nothing. The card kept its standalone
    `max-width: 360px` against a shrink-to-fit flex parent and rendered **205px wide inside a
    336px box** — every value ellipsised at about sixteen characters. It looked like a card with
    long values.

### The brief's three extra pages exist, 2026-09-09

`/corporate`, `/waitlist` and `/contact`. The homepage gained `corporate` as an eighth section
— **the second dark surface**, which the close used to be alone in being. That is deliberate: it
addresses a different reader than everything around it, and on a page whose only separator is a
change of ground that is the one way to say so. `belief` sits between the two on the wash, so
the alternation still holds and the two dark bands never touch.

Grounds, in order: white · wash · white · wash · white · **deep** · wash · **deep**.

⚠ **The accent has no level on a dark ground.** `--mk-green-display` is derived against white
and the wash and is not legible on `--mk-green-deep`, so `corporate` and the close carry white
headings and no `data-accent`. Do not reach for `accented()` on a dark section.

⚠ **Where a form submission goes is `LEAD_WEBHOOK_URL`, not code.** Both forms post to
`/api/leads`, which forwards there. It is unset by default and the pages say so — 503, and an
email address — rather than showing a tick over a submission nobody received. `src/lib/leads.ts`
carries the reasoning; `.env.example` carries the payload shape.

⚠ **The client's own contact details are NOT in `fixtures/marketing.ts`.** They are in
`src/lib/site.ts`. `fixture-hygiene.test.ts` sweeps everything the fixture module exports and
rejects any registrable domain — that rule is right, and it exists so invented demo data can
never point at somebody's real business. The company's own address is neither invented nor demo,
so the fix was the distinction rather than an exemption.

### The brand green, which is new and is the client's own

`#5ABCA9`, taken from the deck, where it is ink and accent **on white** — one word of a
headline, a small-caps label, the CB monogram, an arrow — and never a large ground.

⚠ **It measures 2.28:1 on white, so the brand value itself may never be a word.** The ladder
holds hue 168.4° and saturation 42.2% exactly and moves lightness alone, which is the same
method this file already uses everywhere else:

| level | value | on white | on the wash | may be |
|---|---|---|---|---|
| brand | `#5ABCA9` | 2.28 | — | the monogram, a large shape, a drawn marker. **Never type.** |
| display | `#419F8D` | 3.19 | 3.01 | an accent phrase in a heading, an icon stroke, a control edge. **Large text only.** |
| ink | `#337F70` | 4.78 | 4.51 | labels, links, body copy at any size |
| deep | `#286257` | 7.03 | — | a ground carrying white text |
| wash | `#F2FAF8` | — | — | the alternating section ground |

⚠ **The two inks are derived against the WASH, not white, and a test is why.** Solved on white
they measured 3.01 and 4.52 — legal there, and *below the bar one section down*, because the
wash is the darker of the two grounds (2.85 and 4.26). Nothing looked wrong. The homepage's
contrast sweep in `marketing.spec.ts` named both. The lesson generalises: on a page with two
grounds, derive against the worse one.

⚠ **A near-identical teal already died here.** `--mk-teal #36BAB8` (2.37:1 — the same colour to
the eye) was in `marketing.css` from an earlier pinned brief, used as a **ground and a fill**,
and the homepage came back *"looking very childish"*. That rejection was about the ROLE, not
the hue, which is why the same family of green is now correct: it is ink on white, the way the
brand has always used it. The "marketing stops inventing colour" rule below still holds — this
green is not invented, it is the client's.

## The boundary, and how it is enforced

Every marketing token is `--mk-*` and every utility it generates is `mk-*`. That prefix is the
boundary: an `mk-` utility outside `src/components/marketing/**` or `src/app/(marketing)/**` is
a layering bug, and an app-chrome utility (`text-ink`, `bg-surface`, `border-line`, `text-h1`)
inside them is the same bug in reverse. `tests/e2e/marketing.spec.ts` asserts the second
direction over every file in the directory.

⚠ Marketing components use **`mkcn`** (`components/marketing/mk-cn.ts`), never `cn` from
`@/lib/cn`. `twMerge` cannot infer a custom scale: it filed `text-mk-display` as a *colour*,
saw it conflict with `text-mk-ink`, kept the last one and silently dropped the font size —
every headline rendered at the inherited 15px with the correct classes in the markup and the
CSS rule present. `mk-cn` declares the four `mk-` class groups. **A token bridged in
`marketing.css` and missing from `mk-cn.ts` degrades to that same silent drop.**

## Colour

**Marketing does not invent colour. The palette is the card system's.** Every hue below is one
of the nine grounds in `template-palettes.ts`, reproduced to the digit:

> Onyx `#181A1F` · Sapphire `#142C63` · Emerald `#0D3C2E` · Oxblood `#5B1626` · Rust `#80371C`
> Amber `#E1AA40` · Clay `#E3A28A` · Pistachio `#BFD48C` · Periwinkle `#B4C1EC`

### Why, and which defect it prevents

The card system originally shipped Cobalt / Sky `#22B8CF` / Lime `#C8F751` / Violet and was
rejected in one sentence — *"nobody hands out a cyan business card"* — which is why the cards
were rebuilt as nine muted grounds whose every ink pair is proven by
`tests/contract/template-palettes.test.ts`. The marketing layer then reinstated **the same two
hues** from a separate pinned brief (`--mk-teal #36bab8`, `--mk-lime #7efa55`), and the
homepage was read the same way: *"looking very childish."* Two colour systems inside one
product, drifting apart, is the mechanism by which a rejected note gets delivered twice.
`PRODUCT.md` fixes the register as *"professional, quietly premium — impressive because it is
precise, not because it is loud"*, and the homepage is the loudest surface in the product, so
it is the one that has to hold it.

### Two levels, and the search direction flips per tier

A card ground is proven for ink drawn *on* it. Marketing asks the opposite question of the same
hex — may this colour be drawn *on paper*? — so both levels were re-derived rather than
inherited. Display level = fills, rings, bands, at 3:1. Ink level = anything carrying body
text, at 4.5:1. Same pattern as `--ink` vs `--ink-4`.

⚠ For the five **deep** grounds the binding constraint is not legibility but **separation**:
Sapphire measures 12.27:1 on paper — legal, and useless, because at that ratio a "sapphire"
link and the near-black body copy are the same colour to the eye. For those the search runs the
other way and finds the *lightest* instance of the hue that still clears the bar, the same rule
`derive-palette.ts` uses for `inkSoft`. Hue and saturation held; lightness alone moved.
Generator, and every ratio quoted here: `.scratch-debug/mk-palette-gen.mjs`.

### ⚠⚠ SUPERSEDED 2026-09-08 — THE SHEET IS WHITE AND THE HERO CARRIES A CARD

**Everything in this section is history as of the brief.** It is kept in full, unedited, because
it is the record of four rejected heroes and the reasoning is still the best guide to what
fails on that surface. What replaced it, and why it is not a fifth attempt at the same mistake,
is in `components/marketing/hero.tsx` and in the test
*"the hero carries exactly one object — the live card, and no QR"*. The short version: the four
rejected objects were **pictures of a card** placed in the empty half of the screen; the live
card **performs the product's only claim**. If it is rejected too, the lesson is not "try a
sixth object".

### THE HERO IS A RULED SHEET. THE SKY AND THE MEADOW ARE DELETED.

Three heroes stood here and the client rejected each ground in turn — azure→cyan gradient with
centred type (*"looking very childish"*), Sapphire→Onyx with a tilted card (*"looking very
big"*), Sapphire→Onyx with a film (*"the blue colour and the video being rendered there are
both looking the worst of all, remove both of them"*).

**Every rejection was read as a colour note and answered with a new gradient, which is why it
arrived three times.** The ground was never the defect. A full-bleed coloured rectangle with
centred type is the shape every generated landing page ships; no hue rescues it. What the
reader was looking at was seven hundred vertical pixels of surface doing no work, and a 68ch
subhead centred under a centred headline, which gives the eye no axis to return to.

So the hero's ground is the product's own metaphor, and it is the one the page already argues
two sections down: *"A paper contact book worked because somebody maintained it. You crossed
out an address and wrote the new one above it."* The hero is that page — paper, ruled, with a
margin rule — and the headline is the first entry on it.

| token | value | what it is |
|---|---|---|
| `--mk-ledger-ink` | `rgb(24 26 31 / 0.07)` | the ruling: 1px of Onyx at 7% |
| `--mk-ledger-rhythm` | `--mk-text-display × --mk-text-display-lh` | one ruled row = one headline line |
| `--mk-ledger-lead` | `3rem` / `5rem` at `md` | the ruling's anchor **and** the hero's top padding |
| `--mk-ledger-gutter` | `0.75rem` / `1.25rem` at `md` | the margin rule's x **and** the ruling's left edge |
| `--mk-ledger-margin` | `--mk-oxblood` `#5B1626` | 12.13:1 on paper — the one chromatic mark |

`--mk-sky`, `--mk-sky-from`, `--mk-sky-to`, `.mk-sky`, `.mk-hero-glow`, `.mk-film-frame`,
`.mk-film-screen` and `hero-film.tsx` are all deleted. `--mk-sky-zenith` / `--mk-sky-horizon`
are **kept** — they are Sapphire and Onyx verbatim, bridged into `@theme inline` *and* listed
in `mk-cn.ts`, and a token dropped from one list but not the other degrades to the silent
class-drop `mk-cn.ts` exists to prevent.

#### The two couplings are the craft, and both are load-bearing

The bottom four rows of that table are each **one token with two consumers**, and that is what
separates a page ruled for this text from lines drawn behind it:

· `--mk-ledger-lead` anchors the repeating gradient *and* is the hero's top padding
  (`pt-[var(--mk-ledger-lead)]`, not a matching number). Because one ruled row is exactly one
  headline line box, anchoring the pattern at the copy block's top edge lands a rule on every
  headline line boundary for free, at every width the clamp passes through.
· `--mk-ledger-gutter` places the margin rule *and* the ruling's left edge. On a real ledger the
  ruling starts at the margin rule; running it edge to edge past the stroke made the two read as
  unrelated systems in the first build.

⚠ It was first declared on `.mk-ledger`, which is a **sibling** of the copy column, not its
ancestor — custom properties inherit down, never across — so the padding resolved to nothing and
the headline slid under the fixed nav. Both are `:root` tokens now.

`tests/e2e/marketing.spec.ts` asserts the register arithmetically (every clause is a whole number
of ruled rows tall, and its top is within 1px of a rule) rather than screenshotting it.

### ⚠ THE RULED GROUND CARRIES ONE INK LEVEL AND HAS NO SECONDARY TIER

The same rule the four washes follow, found the same way — by measuring. `--mk-stone` fails on
this ground at **every** rule density, including densities too faint to see:

| rule | composite ground | `--mk-stone` | |
|---|---|---|---|
| 3% | `#eeeeef` | 4.28:1 | FAIL |
| 4% | `#ececec` | 4.20:1 | FAIL |
| **7%** | **`#e6e6e6`** | **3.98:1** | **FAIL — shipped** |
| 8% | `#e3e3e4` | 3.87:1 | FAIL |

There is no density at which the ruling is visible *and* stone is legal. So every level of hero
copy is `--mk-ink` at full strength — 13.95:1 over a rule, 15.97:1 between them — and hierarchy
is carried by size alone. `<Prose>` defaults to `tone="stone"`, so this is asserted on the
**rendered** colour: a future hand omitting `tone="ink"` gets the illegal level silently, and it
looks fine in a screenshot.

### The display step went to 88px, because the type is now the composition

`--mk-text-display` was `clamp(2.75rem, 1.5rem + 5vw, 4.5rem)` and is now `…, 5.5rem)` — 44 → 88px.
With a film in it the hero had a second object to hold the right half of a 1440 sheet. Text-only,
72px left the copy occupying ~615px of 1440 with the rest empty: the same *surface doing no work*,
in a lighter colour. 88px stays inside craft-floor's 6rem ceiling, and the hero owns the page's
only display step — `broadcast.tsx` says so — so nothing else moved.

⚠ This also moves the ruling, and that is correct rather than a side effect: the rhythm is
derived from this token, so a larger headline is set on a more generous ruling and the two stay
in register by construction.

### Amber is the action colour, and it is legal only on a dark ground

| | ratio |
|---|---|
| label `#3A2408` on fill `#E1AA40` — Amber's own `buttonInk`/`ground` pair | **6.98:1** |
| fill on the Onyx close | 8.31:1 |
| fill on paper | **1.92:1 — ILLEGAL** |
| fill on white | **2.09:1 — ILLEGAL** |

The last two lines are a WCAG 1.4.11 constraint, not a taste one: on paper the fill has no
findable boundary, so the control stops being locatable before its label is read.

⚠ **Amber now appears in exactly ONE place on this page: the close, on Onyx.** It was also the
hero's primary for two builds, which was legal only because the hero was a dark sky. On the
ruled sheet it measures 1.92:1, so the hero's primary is `dark` (Onyx, 15.97:1 on paper) —
which is the substitution this section already prescribed and `PillNav` already used.

That left the page with no light-ground SECONDARY, and `line` was added for it: no fill, a ring
at ink/55 measuring 3.81:1 on bare paper and 3.31:1 where it crosses a rule. `glass` needs a dark
backdrop to be a surface at all and went with the sky; `white` on paper is a 1.06:1 boundary;
`ghost` draws none by design. The old lime never had any of these constraints, because a colour
bright enough to sit on anything is also bright enough to shout on everything.

### ⚠ SUPERSEDED 2026-09-08 — four washes became one

Clay, Pistachio, Periwinkle and Amber are no longer section grounds. The page alternates white
and `--mk-wash #F2FAF8` and nothing else; the four names survive in `<Section>`'s `tone` union
as **migration shims** pointing at white or the wash, to be deleted as each section that still
names one is rewritten. The nine card grounds are untouched and are what the example-cards
tiles wear — the washes were the marketing layer's *dilution* of them, and diluting a measured
palette is what produced the substitution rule below.

### The washes were card grounds, and the substitution rule got harder

| wash | was | ink | stone | pebble |
|---|---|---|---|---|
| `clay` `#E3A28A` | mint `#cbfbf1` | 8.12:1 | 2.32:1 | 2.30:1 |
| `pistachio` `#BFD48C` | peach `#f8ebd8` | 10.79:1 | 3.07:1 | 3.05:1 |
| `periwinkle` `#B4C1EC` | lavender `#ede9fe` | 9.76:1 | 2.78:1 | 2.76:1 |
| `amber` `#E1AA40` | teal-mist `#cff2ef` | 8.31:1 | 2.37:1 | 2.35:1 |

Stone was a *near* miss on the pastels (3.99–4.21). On these it is not close. Body copy on a
wash is `tone="ink"` at **full strength** — and the old note that secondary text could be
`text-mk-ink/70` is withdrawn: that composites to 4.34:1 on Clay and 4.44:1 on Amber. **A wash
carries one ink level and has no secondary tier.** Ink at 15% is still fine for interior rules,
which are decorative and owe nothing. On the `ink` (Onyx) ground, text is white — 17.41:1, with
75% white at 10.18:1 for the secondary line.

⚠ `amber` is both a wash tone and the action fill, so an Amber pass may not carry the Amber CTA.
No section takes that tone today; the trap is recorded in `SectionProps.tone`.

### The accents

| role | token | value | measured |
|---|---|---|---|
| link + inline accent text | `--mk-sapphire-ink` | `#3B6BD7` | 4.51:1 on paper, 4.92:1 on white |
| focus ring, non-text accents | `--mk-sapphire-lift` | `#567FDD` | 3.52:1 on paper (it also held 3.49:1 on the deleted sky) |
| the one numeral mark (`Figure tone="accent"`) | `--mk-emerald-ink` | `#1C7F62` | 4.52:1 on paper, 3.53:1 from the ink beside it |
| roadmap status, node ring | `--mk-oxblood` | `#5B1626` | 7.42:1 on the Periwinkle wash |
| node ring | `--mk-rust` | `#80371C` | 4.75:1 on the same wash |

The focus ring is a real improvement rather than a rename: `--mk-azure` held 3.46:1 on paper but
roughly 1.4:1 on the old sky, so in the hero the white halo *was* the focus indicator.
`--mk-sapphire-lift` clears 3:1 on both grounds by itself.

The marker set is closed and now runs Sapphire / Oxblood / Rust / Emerald. ⚠ **Periwinkle is not
in it**, even though it is one of the nine. It was excluded because the `assistant` pass sat on
the Periwinkle wash and a Periwinkle ring would have measured 1.0:1 against its own ground; that
pass is now cut, but the exclusion stands — the set is closed at four and re-opening it needs a
section that wants a fifth marker, not merely the absence of the old objection.

## Type

**Space Grotesk** for display, **Geist** for everything else — the same display face the app
uses, loaded once on `<html>` by the root layout as `--font-space`.

It was Fraunces, route-scoped in `(marketing)/layout.tsx`. That layout now imports no typeface
at all. The reason is not that Fraunces is a bad face: Space Grotesk is already bound to the
app's `.text-h1/2/3`, so a visitor who read a Fraunces headline on `/` and signed up met a Space
Grotesk one two screens later. Body copy was already metrically identical either side of that
transition; the headline was the one thing that changed voice, at exactly the moment a reader
decides whether these are the same product. The route also now downloads nothing of its own.

### ⚠ The tracking sign flipped, and that is the whole retune

Positive display tracking was Fraunces' signature — a wide, letterspaced serif is a period
reference. Space Grotesk is a grotesque: its counters are already open and its sidebearings
already generous, so at 72px `+0.02em` does not read as editorial, it reads as a headline that
failed to justify. The correction is proportional to the size and relaxes back to zero as the
scale approaches body copy:

| step | size | was | now |
|---|---|---|---|
| `display` (hero only, one per page) | 44→**88px** | +0.02em | **-0.03em** |
| `heading-xl` (**one section only**, `broadcast`) | 36→60px | +0.02em | **-0.025em** |
| `heading-lg` (every other head) | 32→48px | +0.02em | **-0.02em** |
| `heading` | 24→30px | +0.02em | **-0.015em** |
| `heading-sm` (Geist, plus the wordmark) | 24px | -0.025em | **-0.02em** |
| `subheading` | 18px | 0em | 0em |
| `eyebrow` | 11px caps | +0.1em | +0.1em |

`heading-sm` was already negative — it was the *sans* step — and only loosened because the
wordmark sets it in the display face, where 24px Space Grotesk at -0.025em collides on the
double `t`. Eyebrow tracking stays positive: on 11px uppercase that is legibility, not a
display signature.

Sizes were re-checked as well as tracking, because a serif and a grotesque do not have the same
optical size. They hold: Space Grotesk's cap height (0.70em) and Fraunces' (0.72em) are within
two points, and the measures are in `ch`, which self-corrects for the narrower face. The
rendered ladder at 1440 is 72 / 60 / 48 / 24 / 18 / 16 / 14 / 12 / 11.

`--mk-weight-display` moved from **750 to 700** and `--mk-weight-heavy` (900) was deleted:
Fraunces runs 400–900 so 750 was a real interpolated instance, but Space Grotesk's `wght` axis
stops at 700, where both of those clamp onto the same weight. A token that cannot deliver a
level it names is worse than no token; nothing referenced `font-mk-heavy`.

Measures are tokens, never `ch` literals: `--mk-measure-display` (**24ch** — 16ch was tuned for centred type; ranged left it broke the second clause across two lines and turned a two-line headline into a four-line rag), `-head` (26ch),
`-tight` (46ch), default (68ch), `-wide` (75ch). Fourteen distinct literals appeared in one
build before these existed.

⚠ **No eyebrow or kicker above a heading, ever.** The heading carries its own weight. Every
`overline` field was deleted from the copy fixture and `SectionHead` does not accept one. A
label above a *list* (the field index's group labels, the footer's nav columns) is a different
thing and is fine.

## ⚠ SUPERSEDED 2026-09-08 — the deck is flat

The wallet is gone: no inset, no radius, no shadow, no overlap. A ground change is the only
separator between two sections, which is why `--mk-wash` exists and why `marketing.spec.ts`
asserts that **no two adjacent sections share a ground** — on a flat page an alternation bug
does not look like a bug, it looks like one very long section.

The brief asks for a page that "just scrolls down". Eight overlapping passes make every
boundary a visual event, and the reader is made to notice the furniture instead of the
argument. `--mk-pass-overlap` and `--mk-pass-shadow` are unreferenced.

⚠ `deal` also lost its `scale(0.972)`, and that is a **performance** fix as much as a design
one: scaling a band scales its type, so the browser rasterises the glyphs at the wrong size and
either re-rasterises mid-flight or shows a blurred interpolation of them — on the largest
elements on the page, for 900ms, on a build whose stated requirement is no visible lag. The
move is `translateY(32px)` and nothing else. The NAME is kept because the vocabulary
`{deal, rise}` is the contract; retuning a move inside the set is allowed, inventing a third is
not.

## Structure — the Wallet Deck (history)

The page is a wallet. The hero is the ruled sheet the deck lies on; every section after it is a
— inset, its own ground, `rounded-[28px] md:rounded-[36px]`, `--mk-pass-shadow`, riding
`--mk-pass-overlap` (44px) over the lip of the one before it. `<Section>` owns all of that.

⚠ **The overlap lives on the `<section>`, not on the pass inside it.** It was
`-mt-[…] first:mt-0` on `[data-pass]`, which is the only child of its section — so
`:first-child` matched all eight passes and cancelled the overlap on every one. The deck did
not stack and nothing caught it. `relative` on the section is what makes DOM order the paint
order; without it the stack inverts.

**Nothing draws its own pass.** No `box-shadow` and no second radiused fill inside a `<Section>`.
⚠ The one documented exception lived in `assistant.tsx` — design.md's Context Graph Node, a
named component in the pinned brief, which outranked the general rule. **That pass is cut and
the exception is withdrawn with it.** Nothing in the deck now draws a second radiused fill
inside a `<Section>`, and a shadow inside a shadow is still what makes a nested card read as a
mistake.

⚠ **Seven passes, down from nine.** Ground order is composed, not alternated: `hero` ruled paper · `problem` white · `how-it-works` paper ·
`broadcast` Pistachio · `trust` Clay · `faq` paper ·
`start` Onyx. The close is the only dark surface on the page.

## Motion

**Two load moves in the hero, two scroll moves in the deck, and no fifth.**

⚠ This section used to read *"one authored moment, nothing else moves on its own"* and forbade
scroll motion outright. The client overrode it: *"I want you to add the loading animations and
the scroll effect also… when the user is scrolling, the scroll effect should also be a very
smooth and very crazy transition."*

The objection behind the old rule was not wrong, and it is what the vocabulary below is designed
against: scattered reveals "read as a template with a plugin attached, they leave a mid-page
visitor looking at nothing, and they make every section behave identically." The answer to that
is not *no motion*; it is a **closed, named vocabulary owned in one place**, which a section
cannot extend without a test failing.

| move | fires | on | what it is |
|---|---|---|---|
| `line` | load | each clause of the hero headline | a clip-wipe upward, 1100ms, 140ms apart — the line is written onto the sheet |
| `copy` | load | hero lead, controls, caveat | a 14px rise, offset 420ms so it begins as clause two lands |
| `deal` | scroll | every pass, via `<Section>` | 40px rise from `scale(0.972)`, 900ms — a card placed onto the stack |
| `rise` | scroll | contents inside a pass | 18px, capped 70ms stagger, so a group arrives as a group |

`deal` is owned by `<Section>` rather than by each section, which is the structural answer to
"every section behaves identically": the deck moves **as a deck**, and no individual pass can
invent a seventh entrance for itself. `marketing.spec.ts` asserts the set of move names is
exactly `{deal, rise}`.

⚠ **`rise` is used by the bento and NOWHERE ELSE, and that is a constraint rather than an
oversight.** The obvious next place to reach for it is `trust`'s four panels or `broadcast`'s
three facts, and both would break: they are single ruled grids with **shared hairline borders
and no gap** — trust is an even 2×2 whose cells lose and gain borders at `md`, and broadcast's
rules rotate from horizontal to vertical at the same step. Staggering members of a shared-border
grid pulls the rules apart and rejoins them mid-flight, which reads as a rendering fault. Those
grids are one object and the pass's own `deal` is what moves them. The bento's cells are
separate mounts with real gaps between them, which is why they can stagger and these cannot.

### ⚠ THE SAFETY RULE, AND WHY ONLY ONE MOVE MAY HIDE ANYTHING

`armed` is applied by **JavaScript** and removed only by an IntersectionObserver. So anything
that *hides* content while armed is missing for a crawler, for a reader whose script failed, for
every zeroed-duration screenshot this suite takes, and — measured, not theorised — **in a
background tab, where IntersectionObserver does not deliver at all.** Zeroing durations does not
rescue it, because `armed` is a static rule rather than an animation.

So **the scroll moves animate transform only and never opacity.** A displaced element is still
painted, still the right size, still readable; the worst case of a stuck observer is a section
sitting 40px low. That asymmetry is the whole argument. An earlier build faded from `opacity: 0`
and the suite caught it at 768 and 1440, correctly.

`line` is the single exception and it is safe for a mechanical reason rather than a stylistic
one: it is a **pure CSS load animation** with `both` fill and no script anywhere in it. Zeroed
durations land it on the finished state; a failed script never starts it.

Two further rules the implementation earns:

· **Nothing already on screen is ever armed.** Above-the-fold content has no arrival to replay,
  and arming it means the reader watches the first pass jump on every load. It also means a
  stuck observer can never present as "the top of the page is broken".
· **The failsafe is 12 seconds, and it was 2 — which was a bug.** At 2s every pass below the
  fold was released before a reader who spent three seconds on the hero ever scrolled, so the
  scroll move never played once. It looked right in a snapshot and was broken in use. The window
  can be this long *because* the moves are transform-only.

⚠ **The trigger is `threshold: 0` with `rootMargin: 0 0 -12% 0`, not a threshold fraction.** A
threshold is a fraction of the target, so `0.15` fires instantly on a bento cell and waits for
225px on a 1500px pass — the same number produces two different moments depending on size, which
reads as the big sections arriving late.

⚠ **A live QR inside a scaling ancestor has one pixel of headroom.** The scan exhibit renders
141px against `MIN_QR_SIZE_PX` of 140, so an armed pass at `scale(0.972)` measures 137. The floor
is a property of a *resting* symbol — a moving one is unscannable at any size — so the test
settles the pass before measuring. Any future transform on an ancestor spends headroom that does
not exist.

Interaction motion is unchanged: a control pressing, an answer opening, a link underlining, on
`--mk-dur-tap` / `--mk-ease` (a real exponential-out; the `ease-out` keyword keeps accelerating
into the middle and reads as hesitation against a spring).

⚠ **`apps/video` is unreferenced by the site.** The Remotion project and `public/hero/*` are
deliberately NOT deleted — they may serve another surface — but no route may load one, and a
source test enforces it. A 1.5MB WebM that nothing renders is dead weight the moment somebody
re-adds a `<video>` "because the file is already there", which is how the hero acquired one.

## Icons

**Drawn, never glyphed.** Inline SVG, 2px stroke, `currentColor`, `aria-hidden`. A `+` or `✓`
standing in for an icon is a costume. Only `trust` carries an icon set, because its four claims
are otherwise four identical text blocks.

## The surfaces we did not draw

Selection (Amber, carrying Amber's own `#3A2408` button ink at 6.98:1), caret, scrollbar, focus
ring (`--mk-sapphire-lift` plus a white halo, and the ring alone clears 3:1 on paper
unaided), underline offset and tabular numerals are all themed from the palette, scoped to
`[data-mk-root]`. Leaving them is the cheapest tell that a page was assembled.

## Content rules that are design rules

- **No fabricated social proof.** No testimonials, no logos, no benchmarks. A previous build
  shipped three invented testimonials.
- **No invented figures.** Pricing is not settled, so there is no pricing section.
- ⚠ **Nothing on the page may describe an unshipped capability.** This replaced a rule about
  *disclosing* one. The WhatsApp assistant had a whole pass written in the present tense with a
  body-size paragraph carrying the entire correction; the pass was cut when the client asked for
  a crisper page, and cutting it removed the disclosure obligation rather than weakening it.
  `marketing.spec.ts` now scans the rendered page for "coming soon", "not built yet", "waitlist"
  and their neighbours, so re-adding a roadmap section has to fail a test first.
- Demo domains must be RFC 2606/6761 reserved.

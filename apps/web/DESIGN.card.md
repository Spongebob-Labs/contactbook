# Design — the card

<!-- Written at finish, from the built world. -->

**Three colour systems, and they must not mix.** `DESIGN.md` documents the **marketing** world
(`--mk-*`). App chrome is the near-monochrome system in `src/styles/tokens.css`. **This file
documents the third: the card**, whose colour is per-card data, not a token.

This file exists separately because `DESIGN.md` was rewritten by the marketing track while the
card work was in flight, and the card's decisions would otherwise survive only as code comments.
Its own opening line already declares the split.

## Scope

Everything here applies to the **card page** — `/c/{slug}`, the surface a recipient opens, and
the object the builder previews. **None of it applies to the wallet face**, which is one fixed
336×500 format whose only variation is colour and whose QR five contract suites measure.

## The register

Quietly premium. A card someone keeps for years. Linktree is right about *mechanism* — wallpapers,
patterns, header layouts, a ground that holds still — and wrong about *register* for us. We take
the controls and spend them on restraint. The test: **would a partnerships lead hand this to a
client?** Bold is allowed. Loud is not.

## The four axes

`src/card/card-surface.ts` is the contract. `flat · gradient · mesh · grain · pattern` ×
`grid · dots · hatch · arcs · topo` × `classic · banner · hero · minimal` × any ground colour.

### Ground colour is free, and the floor is arithmetic

`src/card/derive-palette.ts` turns any hex into a complete `TemplatePalette` by searching along
the requested colour's own hue ray — never a closed-form formula. Proven over **4,500 palettes**
plus a byte-resolution walk across both band edges.

**The dead band is not policy.** Only two inks exist (white, near-black) and the 7:1 headroom rule
means white needs `L ≤ 0.100` and near-black `L ≥ 0.339`. Nothing between can be a card ground.
That — not taste — is why the nine presets are five deep and four light with nothing in the middle.
A colour inside the band is clamped to the nearer edge in *relative luminance*, hue preserved, and
the owner is told plainly.

⚠ **Saturation multipliers were read back off the presets, not guessed.** HSL saturation is not
perceptual: the intuitive 0.32 derived a cool grey `#DADEE7` where Sapphire has a pale blue. At
0.9 the engine derives `#CED9F3` against a hand-authored `#CBD9F7` — three bytes.

## Ink-side decoration must be solved, not chosen

`pattern`, `grain` and `mesh` all put ink-side colour **behind ink-side text** — on every palette
the accent, secondary ink and rule colour sit on the same side of the ground as the ink, because
each was chosen to be legible on it. So the motif alpha and the mesh bloom percentages **step down
from what the design wants until the composited ground still clears 7:1 primary / 4.5:1 secondary
on that specific palette.** `PATTERN_ALPHA` is a ceiling, never a target.

```
             motif alpha      mesh (wanted 14/14/26)   worst ink / soft
onyx         0.060 clamped     6.0 / 11.5 / 26          14.76 / 4.50
sapphire     0.070 ceiling    10.5 / 14.0 / 26          10.36 / 4.51
rust         0.070 ceiling     7.5 / 10.0 / 26           7.01 / 4.57
clay         0.070 ceiling    14.0 / 14.0 / 26           7.00 / 4.62
```

Onyx and Rust get a quieter card because they have no headroom left. **That is the correct
outcome, produced automatically — not a compromise.** Overlapping blooms are checked as a
channel-wise envelope, because three individually safe colours can composite into a fourth that
is not.

**Pattern and grain sit on the flat ground, never the gradient.** Ink clears 7:1 on every stop
with almost nothing spare (Rust: 7.13:1 at its light end), so a motif over a gradient solves to
near zero.

⚠ **The motif SVGs bake the ink colour in rather than being CSS-masked.** A `mask-image` over
`background-color: var(--c-ink)` would follow the property for free — but its failure mode is a
**solid ink rectangle over the card**. Baking fails the other way: no support means no pattern,
and the card is merely plain. Choose the failure direction, not the elegance.

## The ground holds still

A `position: fixed` painted layer behind `position: relative` content — **not**
`background-attachment: fixed`, which is unreliable on iOS Safari, the exact surface this is read
on.

⚠ **The polarity is inverted from the obvious one, and that is load-bearing.** `position: fixed`
is contained only by a transform/filter/`contain` ancestor — **`overflow` does not make one.** Two
of `CardPage`'s three consumers are scrolled frames (the builder preview, the marketing card
objects) where a fixed-by-default ground escapes and paints the whole browser viewport. So the
base is `relative`, and `[data-card-page-surface]` — emitted only by `public-card-view.tsx` —
opts in.

Proven by pixel diff, not by eye: clipped screenshots of exposed ground before and after a real
scroll, `0 / 216000` differing channels at 1440, `0 / 18000` at 768.

## The ground does not depend on the field count

**The card is a flex column and the body below the hero is the flexible track.** The ground is
`inset: 0` of the card root, and the card root used to have no height of its own — so it was as
tall as whatever the owner happened to have mapped. Take the fields off and the card shrank to a
hero, the ground shrank with it, and the frame's white showed through beneath: the background
appeared to *disappear* for a reason that had nothing to do with colour.

Field count is not a design axis. Where the card is given room (the builder's phone frame, a
tile) the body takes it and the ground is painted edge to edge at zero fields or twenty-five.
Where it is not — `/c/{slug}`, whose parent height is indefinite — there is no free space to
distribute, nothing moves, and the fixed ground goes on painting the viewport as before.

⚠ Still **no height, no `max-height`, no `overflow`** on the card. `flex-grow` cannot shrink a
box below its content, so the long card is laid out in full and the *frame* is what scrolls.

## The name is sized in absolutes, and that is not laziness

26px on `classic` and `banner`, 34px on `hero`, 20px on `minimal` — a three-step scale in
`card-page.tsx`, not a `clamp()`.

⚠ **A `vw` clamp sizes the name from a box the name is not in.** `--text-h1` is
`clamp(2rem, 1.25rem + 1.5625vw, 2.75rem)`, written for a full-bleed app screen; the card is
`--page-measure` (460px) at most and 336px inside the builder's frame, while the viewport behind
both is a desktop. The clamp resolved at its 44px ceiling and set a two-word name over three
lines in a 288px column.

Container query units are the textbook fix and are **unusable here**: `container-type:
inline-size` applies `contain: layout`, which makes the element a containing block for
`position: fixed` descendants — silently undoing "the ground holds still" on the one surface
that depends on it.

## Motion — one authored moment

The stack rises: `opacity 0 → 1`, `translate 0 10px → 0`, `--dur-base` on
`cubic-bezier(0.16, 1, 0.3, 1)`, staggered `index × 40ms` capped at 560ms, inside
`prefers-reduced-motion: no-preference`, scoped to `[data-card-page-surface]` so the builder
preview gains no load animation.

⚠ **`animation-fill-mode: backwards`, and the final state is the default.** The e2e harness kills
animation globally; a card that is invisible until an animation runs fails every screenshot in the
suite. Verified under all three conditions — `reduce`, `no-preference`, and the kill stylesheet.

Hover lifts 1px with an inset ink ring; press returns flush. **The border brightens through an
inset ring, not `border-color`** — the border is an inline shorthand and inline beats any
non-`!important` rule.

## Browser surfaces

`::selection` and the caret are **split by `[data-card-on-palette]`**, and that split is not
cosmetic: `--c-ink` is white on the five deep palettes, so one ink-tinted rule paints white on
white the moment a reader drags across `banner`'s canvas body.

The scrollbar must be set on `documentElement` (the viewport's scrollbar belongs to the document
and `--c-*` cannot travel upward), so two resolved values are lifted onto `:root` in an effect and
removed on unmount. A React 19 hoisted `<style>` is fewer lines and **wrong** — React does not
remove those, so navigating away leaves an onyx scrollbar on the dashboard.

**The focus ring is deliberately not re-tinted per card.** `globals.css` ships one unlayered
ink→white→ground sandwich already proven ≥3:1 against every palette by
`tests/contract/focus-ring.test.ts`. Re-tinting swaps a proven contrast for an unchecked one.

## Contract notes

- `data-page-header` on `[data-card-root]` now carries the **`HeaderLayout`**; the template's
  legacy `PageHeader` is published beside it as `data-template-page-header`.
- Header layout changes **composition only** — never which fields appear, what they do, or their
  order. `cardPageRows()` is never passed the layout, so this is structural rather than a rule.
- The card renders `[...resolved.fields, ...resolved.socialFields]`, the same concatenation
  `buildVcf` writes, so the visible set and the file set are one set.

## Refused

Gradient text. Glass as decoration. Nested cards. Eyebrows above headings. Hard offset shadows.
Section numbers. Raster wallpapers or any network request. Any pattern loud enough to compete with
the name.

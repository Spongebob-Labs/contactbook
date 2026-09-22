# Marketing imagery

## What's here now

- `logo-mark.svg` — the hero card's badge mark (two interlocking gold rings).
  Wired live: `heroCard.logoUrl` in `src/fixtures/marketing.ts` points at it,
  and `resolveBadge` (`src/card/resolve-card.ts`) puts a card's own `logoUrl`
  ahead of the initials monogram, so the badge shows this mark instead of
  "PR". This one costs no layout height — it fills a 64px badge slot that
  was going to be drawn either way — so it is on unconditionally.
- `hero-cover.svg` — an authored warm-gold abstract for the card's cover,
  sized to `COVER_RATIO.photo`'s exact aspect. It is **not** wired live: see
  `HERO_COVER_URL`'s own comment in `src/fixtures/marketing.ts` for the full
  account. Short version — turning it on costs `+134px` at this card's fixed
  336px hero width (`COVER_RATIO.photo` vs `.none`) and, measured, re-clips
  the SOCIAL strip that a 2026-09-20 pass just fixed. The constant is `null`
  by that measurement, not by omission; flipping it to
  `"/marketing/hero-cover.svg"` is still a one-line, fully working change.

## The real photograph, whenever it arrives

Drop it here as `hero-cover.jpg`, then flip `HERO_COVER_URL` in
`src/fixtures/marketing.ts` from `null` to `"/marketing/hero-cover.jpg"`.
That constant is the only switch — `resolveCover` already ranks
`ContactCard.coverUrl` ahead of any profile photo field. Re-measure the card's
height against `.mk-phone-frame__screen` (728px at this card's width) after:
the same `+134px` cost applies to a photograph as it does to the SVG above,
and whatever the row count is by then may need to give a little to pay for it.

Wanted: roughly 3:2 landscape, >=1200px wide, warm tones. `<CardCover>` crops to
`50% 28%`, so leave headroom above the subject's eyes.

NOTE — the circular badge that straddles the cover's curve will keep showing
`logo-mark.svg` regardless of what the cover is. `resolveBadge` and
`resolveCover` are two independent slots by design (a card's mark and a
card's photograph); giving the badge a portrait instead is a change to
`src/card/**`, not to this directory.

`public/portraits/*.png` are green silhouette placeholders and
`public/templates/*.png` are blurred dark abstracts. Neither is a usable
portrait, and both predate the warm palette.

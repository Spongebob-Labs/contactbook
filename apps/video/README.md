# `apps/video` — the hero film

A 15-second silent loop that plays in the marketing site's hero. It is not a demo reel and not
a feature montage: it is the product's four events, in order, and nothing else.

```
0.0-3.0s   the pass at rest, its QR facing out         "this is what you hand over"
3.0-6.0s   a scan crosses the code                     "this is how it is taken"
6.0-9.5s   the card page rises from behind the pass    "this is what they get"
9.5-13.0s  the number changes and the update lands     "this is what keeps it true"
13.0-15.0s the page settles back, the pass returns     the loop closes on frame 0
```

## Commands

```bash
pnpm --filter video studio     # the Remotion studio, for editing with a live preview
pnpm --filter video render     # -> apps/web/public/hero/hero-loop.mp4
pnpm --filter video render:webm
pnpm --filter video still      # -> apps/web/public/hero/hero-poster.jpg (frame 36)
```

The web app serves the WebM first and falls back to the MP4, with the still as the poster and
as the whole film for anyone who asked for reduced motion.

## Three things worth knowing before editing

**The loop is seamless by arithmetic, not by a crossfade.** The last frame is composed to equal
the first: the sky's drift is a full sine over the duration, the page has fully retreated, and
the phone number has flipped *back* to the original. That last one is easy to miss — a loop
where the number stays changed shows the update once and then misrepresents the starting state
on every subsequent play.

**The QR is real.** It encodes `https://contactbook.app/c/prya-hq` through the same `qrcode`
library the product uses, drawn as SVG rects on integer module coordinates so the edges stay
hard. Verified by decoding it back out of a rendered frame with `jsqr`. A rasterised or
decorative lookalike would have been half the work and is the detail that tells a viewer the
product is a mockup.

**Every value comes from `useCurrentFrame`.** No CSS transition and no CSS animation appears
anywhere in `src/`. They are not driven by Remotion's clock and render as either a frozen first
frame or a strobe.

## The palette is mirrored, not imported

`src/theme.ts` duplicates the values from `apps/web/src/styles/marketing.css`, because Remotion
renders in a headless browser that never loads the web app's stylesheet. The duplication is
one-directional: **that file is the source of truth and this one follows it.** Several values
there were derived by search to satisfy a contrast contract, so copying rather than
re-eyeballing is what preserves the property.

## Frame size

720 x 1080 — the product's own 336:500 pass ratio, near enough that the film sits in a
pass-shaped slot on the page with no letterbox. A 16:9 hero film would have to be cropped into
that slot, which on a film whose subject is a portrait card means showing the middle third of a
business card.

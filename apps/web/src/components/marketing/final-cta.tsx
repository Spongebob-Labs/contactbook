import { close } from "@/fixtures/marketing";

import { Section } from "./section";
import { Heading, MkButtonLink, Prose } from "./type";

/**
 * The close — the last pass in the deck, and the only dark one.
 *
 * ## Ink is the argument, not a mood
 * Seven passes have gone by on white, paper and the four washes. Ending the eighth on
 * `--mk-ink` inverts the page at the end of the scroll, and inversion is the one separation
 * device the stack has not spent yet: the reader has been shown light objects on a light ground
 * for the whole way down, so a dark one arriving last does not read as another card in the
 * sequence — it reads as the sequence stopping. An eighth light ground would have read as the
 * eighth light ground.
 *
 * The ground is `--mk-ink`, which is now **Onyx `#181A1F`** — the card system's one neutral,
 * so the darkest surface on the marketing site and the darkest card the product ships are
 * literally the same colour.
 *
 * It also buys back contrast the washes never had. `--mk-white` on `--mk-ink` measures
 * **17.41:1** against the 8.1-10.8:1 ink-on-wash band, and the secondary line here sits at
 * **10.18:1** (75% white composited over Onyx) where a wash's secondary has no legal level at
 * all. `--mk-stone` (2.30-3.07:1 on the four washes, 3.51:1 here) and `--mk-pebble` are
 * illegal on both for the same reason: they are mid-greys, and a mid-grey is unsafe at both
 * ends of the ramp.
 *
 * ## Amber is the action, and it is the colour that survives the invert
 * It was Live Lime, at 12.25:1 on near-black — arithmetically excellent and the wrong colour,
 * being one of the two hues the card system was rejected over. Amber `#E1AA40` measures
 * **8.31:1** against this Onyx ground, so the button is legible AS AN OBJECT before a word of
 * its label is read, which is what a lone control at the end of a page has to do; and its
 * label, Amber's own `#3A2408`, measures 6.98:1 on the fill.
 *
 * The two rejected alternatives are unchanged and still rejected: `white` measures 17.41:1 but
 * a flat white fill on ink reads as a hole punched through the pass rather than a thing lying
 * on it, and `dark` is invisible — it *is* this ground.
 *
 * ⚠ This pass and the hero are the only two places `amber` may be used, and the reason is in
 * `type.tsx`: the fill measures 1.92:1 on paper. A dark ground is a precondition, not a
 * preference.
 *
 * ## ⚠ The headline's colour arrives by inheritance, and that is a measured workaround
 * `mk-cn.ts` names the `mk-` font sizes twMerge cannot infer, and its list stops at
 * `mk-heading-lg` — **`mk-heading-xl` is missing**, so mkcn files `text-mk-heading-xl` as a
 * text COLOUR. Measured against the installed tailwind-merge 3.6.0 with that exact extend
 * block, `mkcn("… text-mk-ink …", "text-mk-heading-xl", "text-mk-white")` returns
 * `font-mk-display font-mk-editorial text-balance text-mk-white`: passing a colour to
 * `<Heading >` silently eats the 36-60px size and the headline renders at the
 * inherited body step. It fails in the browser only, exactly as that file's own comment warns.
 *
 * So the pass sets `text-mk-white` and the heading inherits it — with no colour in its
 * `className`, mkcn drops the base `text-mk-ink` instead and the size survives. `[&_h2]:` is
 * the belt to that brace: it is a different modifier group, so it cannot be merged away, and
 * at (0,1,1) it outranks `.text-mk-ink` at (0,1,0) on the day someone correctly adds
 * `mk-heading-xl` to that font-size list and the base colour starts surviving again. Without
 * it, that otherwise-correct fix would turn this headline ink-on-ink and nothing would say so.
 * A regression here is caught by asserting BOTH that the h2's computed `color` is pure white
 * and that its computed `font-size` is above the body step — never one alone, because each
 * failure mode passes the other's check.
 *
 * ## One link, one centred band, and nothing else in the pass
 * `marketing.spec.ts` asserts this section holds exactly one link role at `close.cta.href`,
 * and separately that the page's centred sections are exactly `hero` and `start`. Both are the
 * design, not overhead: a second control here (pricing, a tour, a "read more") turns a close
 * into a decision point, and the centring budget is only meaningful because the seven passes
 * between the two spenders are not centred. The footer's navigation is a layout landmark below
 * this pass, so the exits exist — they are just not in the last thing the reader is asked.
 *
 * There is no eyebrow (banned outright), no rule, no footnote and no panel: the pass is already
 * the card, and the copy is three fixture strings with a lot of air around them.
 */
export function FinalCta() {
  return (
    <Section
      id="start"
      tone="ink"
      labelledBy="start-heading"
      className="text-center text-mk-white [&_h2]:text-mk-white"
    >
      <Heading id="start-heading" >
        {close.headline}
      </Heading>

      {/*
        The tight measure (46ch), centred. `close.body` is 121 characters: on the tight measure
        it sets in three centred lines that stay inside the headline's own width, which is what
        makes the block read as one shape. The default 68ch measure drops it to two long lines
        that overhang the 19-character headline symmetrically on both sides — centred text makes
        that overhang obvious in a way a left-aligned block hides.

        `text-mk-white/75` rather than a `tone`: `<Prose>` has no white tone, and both of the
        ones it has are illegal here — `stone` fails AA and `ink` is the ground. mkcn merges
        this correctly (`mk-body`/`mk-subheading` ARE in its font-size list), so the lead step
        survives and the base colour is dropped; only the xl heading above hits that hazard.
      */}
      <Prose size="lead" className="mx-auto mt-7 max-w-mk-measure-tight text-mk-white/75">
        {close.body}
      </Prose>

      {/*
        48px of air below the paragraph, 56 at desktop — nearly twice the 28px that separates the
        paragraph from the headline, so the control reads as a separate act rather than as that
        paragraph's last line. It is the only vertical measurement in this file: the pass owns its
        80/112/128px rhythm and must not be overridden from here. The margin sits on the control
        itself because `text-center` on the pass is what centres it — an inline-flex box centres
        in its line box, and a wrapping flex row would only be a second thing to keep in sync.
      */}
      <MkButtonLink href={close.cta.href} variant="amber" size="lg" className="mt-12 md:mt-14">
        {close.cta.label}
      </MkButtonLink>
    </Section>
  );
}

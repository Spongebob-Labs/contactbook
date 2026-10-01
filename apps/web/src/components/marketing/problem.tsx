import { problem } from "@/fixtures/marketing";

import { mkcn } from "./mk-cn";
import { MkReveal } from "./mk-reveal";
import { Section } from "./section";
import { accented, HEAD_TO_BODY, Heading, Prose } from "./type";

/**
 * Section 2 — the problem. Brief Section 2.
 *
 * ## REBUILT 2026-09-21 — the client rejected the card TREATMENT, not the argument
 *
 * The client: *"the next section below the hero is also very weak, and it's not making any
 * sense… I don't want you to just include this green card anymore in this. There should be
 * proper professional visuals that you will be taking from the internet."* Their reference is a
 * different register entirely from what this section drew before — a full-bleed photographic
 * band, then a large serif headline beside a supporting paragraph — and it was sent as an
 * explicit alternative to the phone-contact/live-card comparison this file used to render.
 *
 * ⚠ THE BEFORE/AFTER CARD PAIR IS GONE, NOT RECOLOURED. The previous pass's whole device was two
 * panels sharing no code on purpose (a fake phone contact beside a real `<ContactCard>`) so the
 * visual difference between them carried the argument — see git history on this file for that
 * account in full. That device is what got rejected: an editorial photograph-and-headline
 * composition cannot also be a phone-screenshot comparison, and keeping one inside the other
 * would just be the green card the client declined, with a photograph stapled above it. So
 * `liveCard`, `<ContactCard>` and the `INITIALS`/`SETTLED` derivations this file used to carry
 * for that comparison are gone with it.
 *
 * ⚠ FIVE FIXTURE FIELDS ARE NOW UNUSED, FLAGGED RATHER THAN PATCHED OVER OR INVENTED AROUND.
 * `problem.beforeLabel`, `.afterLabel`, `.staleTag` and `.beforeRows` only mean anything beside a
 * rendered phone-contact list — "Saved in your phone" labels a panel that no longer exists, and
 * a struck-through row needs the list it was a row of. `problem.caption` — "Three of these four
 * were true when you saved them" — is the same problem one level up: it is the CAPTION for that
 * exact four-row list, and reads as a dangling reference with the list gone (tried it; a reader
 * hits "these four" with no four things anywhere on the pass). `problem` is fixture data this
 * file may read and may NOT edit (task brief), so inventing a new home for any of these five, or
 * quietly rewriting the caption so it scans on its own, would be new copy wearing old copy's
 * name. Deleting fields from a shared fixture is a call for whoever owns it, not for this file.
 * `problem.heading`, `.accent` and `.paragraphs` are unchanged prose about an out-of-date address
 * book, none of it tied to the card device, and all three are still rendered below.
 *
 * ## The photograph, replaced 2026-09-21 — the client was right, it was decorative
 * The linen band above was surface copied from the reference (a "soft draped fabric" transition)
 * with none of the reference's ROLE: there, it is a thin seam between two sections; here it was
 * a 384px block that answered no question a reader had. The client's own words: *"Can you tell
 * me how this image is actually relevant here? I don't think there is anything in this image
 * that you have actually added."* Correct — crumpled linen has no relationship to "your address
 * book is quietly going stale", and no crop of it would have given it one.
 *
 * The section's actual claim is that a contact starts decaying the moment it is written down —
 * "It went out of date the minute you updated it." So the image that belongs here is not a
 * mood-board texture, it is **the moment that claim is about**: two people meeting for the first
 * time, a handshake, a number and an email changing hands — which is exactly the instant this
 * copy says starts going stale. That is the test the linen failed and this photograph passes:
 * it is here because of what the paragraph says, not because a reference had a coloured band in
 * this position.
 *
 * (Two other options were weighed and set aside, not overlooked: no photograph at all, letting
 * the headline carry the section alone — defensible, but the client has asked twice for "proper
 * professional visuals" and a section that visibly answers that brief is worth more than a
 * purist scroll. And a designed diagram of stale data itself — a struck-through phone-contact
 * card — which is the exact device this file's previous rebuild deleted on purpose, three
 * sections up in this same comment block: reintroducing any version of it here would be the
 * green card the client already declined, wearing a new hue.)
 *
 * Pexels photo 3184291, a handshake across a meeting table (photographer: fauxels) — Pexels
 * License (free for commercial use, no attribution required): pexels.com/photo/3184291/. The
 * original is a six-person meeting; cropped to the handshake itself, centred, with a face on
 * either side of it still legible, so the band reads as a greeting rather than as an anonymous
 * pair of hands. Warm wood table, cream and tan knitwear, no cool blues — the tones the fabric
 * photo was chosen for, kept, on a photograph the copy can actually defend. Saved at
 * `public/marketing/problem-meeting.{jpg,webp}`, 1600×615, ~115KB / ~76KB.
 *
 * ## No eyebrow above the headline, on purpose
 * The reference also shows a numbered kicker (`01 —— BUILT FOR MEANINGFUL CONNECTIONS`) sitting
 * over its headline. `type.tsx`'s `Eyebrow` is explicit that this page banned that construction
 * outright — "never above a section heading… every `overline` field was removed from the copy
 * fixture for this reason and `SectionHead` no longer accepts one." Reintroducing it here would
 * fix one section by breaking a rule every other section still depends on, for a phrase this
 * file would have to invent besides (nothing in `problem` is a kicker). Dropped rather than
 * worked around — the photograph and the headline carry the "editorial" register without it.
 *
 * ## The full-bleed band reaches the page's own edge, never `100vw`
 *
 * (2026-09-28: it now bleeds only from `xl`, and is rounded at every width — see the comment on
 * the band itself. The `100vw` reasoning below still holds for the bleed that remains.)
 * `marketing.css` already flagged why not, on the ledger rule's own `left` calc: "`100vw`
 * includes the scrollbar gutter on any platform that reserves one… invisible on this machine and
 * obvious on Windows." Cancelling `CONTENT_COLUMN`'s own `px-6 md:px-10` (`-mx-6 md:-mx-10`)
 * reaches the section's own edge — the same ground `<Section>` already paints full-width — with
 * no viewport unit involved at all. Below `--mk-page-max` (1200px) that edge IS the viewport
 * edge; above it, the band bleeds to the same 1200px cap the rest of the page holds to, rather
 * than past it, so the page keeps one width for every section instead of a second rule for this
 * one.
 */

export function Problem() {
  return (
    <Section id="problem" tone="wash" labelledBy="problem-heading">
      <MkReveal index={0} move="rise">
        {/* ⚠ ROUNDED, AND INSIDE THE GUTTERS BELOW `xl` — 2026-09-28. The client: *"make the
            hero image slightly more curved"*. This photograph is the first image a visitor
            scrolls into, and it had square corners. A curve reads as an object sitting on the
            ground rather than a strip cut out of it, which is the card language every other
            object on this page already speaks — so 20px on a phone, 28px from `md`, 32px from
            `lg`, stepping up with the image's own size.

            A rounded corner cannot sit against the viewport edge (it reads as clipped), so the
            full-bleed band now only bleeds from `xl`, where the page's 1200px cap leaves a
            margin either side. Below that it sits in the column like the copy beneath it. */}
        <div className="xl:-mx-10">
          {/* `alt=""`: the image illustrates the paragraph beneath it rather than adding a fact
              that is not already in the copy, so it is decorative under WCAG's own test — a
              screen reader skips it rather than describing a stock photo the text already made
              the point of. `loading="lazy"`: the hero fills the first viewport on every tested
              width, so this band is below the fold on load. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/marketing/problem-meeting.jpg"
            alt=""
            width={1600}
            height={615}
            loading="lazy"
            decoding="async"
            className="block h-56 w-full rounded-[20px] object-cover md:h-72 md:rounded-[28px] lg:h-96 lg:rounded-[32px]"
          />
        </div>
      </MkReveal>

      <div className={mkcn(HEAD_TO_BODY, "grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16")}>
        <MkReveal index={1} move="rise">
          <Heading id="problem-heading" className="max-w-mk-measure-head">
            {accented(problem.heading, problem.accent)}
          </Heading>
        </MkReveal>

        <MkReveal index={2} move="rise">
          <div className="flex flex-col gap-4">
            <Prose size="lead" className="max-w-mk-measure">
              {problem.paragraphs[0]}
            </Prose>
            <Prose className="max-w-mk-measure">{problem.paragraphs[1]}</Prose>
          </div>
        </MkReveal>
      </div>
    </Section>
  );
}

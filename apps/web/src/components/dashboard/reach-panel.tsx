import type { CSSProperties, ReactElement } from "react";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import type { DashboardTotals } from "@/lib/dashboard/metrics";
import {
  openLevers,
  type LeverId,
  type MeasuredLever,
  type ReachScore,
} from "@/lib/dashboard/reach-score";
import { cn } from "@/lib/cn";

/**
 * THE REACH PANEL — the score, and the two or three things standing in its way.
 *
 * ## What it replaced, and why
 *
 * Five stat tiles of identical weight: Cards, People reached, Opens, Not opened, Not told. Three
 * of them were counts nobody can act on, all five were drawn with the same border and the same
 * type, and so the page had no headline — nothing on it said whether the owner was doing well or
 * what to do next. A tile is an expensive object; it should be spent on something actionable.
 *
 * The score answers "how am I doing" and the levers answer "what do I do next", which are the
 * only two questions a dashboard's top strip is for. The raw counts survive as a plain strip at
 * the bottom, because they are still worth knowing and deleting data is not a redesign.
 *
 * ## ⚠ Colour comes from the card system, and never from new chrome
 *
 * `PRODUCT.md`: "App chrome is pure white with neutral greys and a near-black accent; per-card
 * colour is a separate system that lives only on cards." So this panel introduces **no hue of
 * its own** — the ring is the app's near-black `--accent` on a `--surface-sunk` track, and the
 * only colour on the whole panel is the existing `--warning-*` pair, which is semantic state and
 * not decoration. The colour a reader sees on this page arrives later, in the reach bars, wearing
 * each card's own palette.
 *
 * That is the whole reason this design survives the brand commitment that a levels-and-XP
 * treatment would have overturned.
 *
 * ## ⚠ Status is never carried by colour alone
 *
 * A finished lever is not merely dimmed — it carries a tick glyph and its sentence changes to the
 * past tense. Dimming alone fails the project's own accessibility floor, and it fails plain
 * legibility for anyone reading the panel at a glance.
 */

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * What each lever says, in both states.
 *
 * ⚠ **Aggregate, deliberately — the per-card detail lives in `<AttentionList>` below it.** An
 * earlier draft named the offending card in each lever ("Name 'Untitled card'"), which read well
 * with two cards and turned into a duplicate of the attention list the moment there were six.
 * The lever is the headline and the count; the list underneath is the detail and the links.
 */
const COPY: Record<LeverId, { done: string; open: (l: MeasuredLever) => string; href: string }> = {
  opened: {
    done: "Everyone you reached opened it",
    open: (l) => `${l.outstanding} of ${l.total} people haven’t opened it yet`,
    href: "/contacts",
  },
  told: {
    done: "Everyone is on the current version",
    open: (l) => `Tell ${l.outstanding} ${l.outstanding === 1 ? "person" : "people"} their card changed`,
    href: "/cards",
  },
  ready: {
    done: "Every card is ready to share",
    open: (l) => `Finish ${l.outstanding} of ${l.total} cards`,
    href: "/cards",
  },
};

export interface ReachPanelProps {
  score: ReachScore;
  totals: DashboardTotals;
  /**
   * `2` when the panel heads its own region, `3` inside the dashboard's "Sharing" section.
   * Defaults to `2` so a caller that predates the section keeps a valid outline.
   */
  headingLevel?: 2 | 3;
}

export function ReachPanel({ score, totals, headingLevel = 2 }: ReachPanelProps): ReactElement {
  const actions = openLevers(score);
  const done = score.levers.filter((l) => l.state === "done");
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    /* ⚠ **Flat on the canvas since 2026-09-28.** This panel used to be the one lifted object on
       the page. The summary tiles above it are that object now (Profile, Cards, Contacts, in the
       order the client asked for), and a second lifted level under them would flatten the
       hierarchy again, because when everything is a card nothing is.

       `@container`: the panel sits in a half-width column from `lg`, which is 349px at a 1024px
       viewport. A viewport breakpoint would put the dial beside the levers there and truncate
       every lever; the panel's own width decides instead. */
    <section
      data-reach-panel=""
      aria-labelledby="reach-score-heading"
      className="@container flex flex-col gap-5"
    >
      <div className="flex flex-col gap-6 @md:flex-row @md:items-center @md:gap-8">
        <ScoreDial score={score.score} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Heading id="reach-score-heading" className="text-overline uppercase text-ink-3">
            {score.score === null
              ? "No score yet"
              : actions.length === 0
                ? "Nothing is holding it back"
                : "What's holding it back"}
          </Heading>

          {score.score === null ? null : (
            <ul className="flex flex-col gap-2">
              {actions.map((lever) => (
                <li key={lever.id}>
                  <Link
                    href={COPY[lever.id].href}
                    data-reach-lever={lever.id}
                    className={cn(
                      "group flex items-center gap-3 rounded-md border border-line bg-canvas",
                      "px-3 py-2.5 transition-colors duration-[var(--dur-fast)] hover:border-line-control",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "shrink-0 rounded-sm bg-accent-wash px-1.5 py-0.5",
                        "text-xs font-medium tabular-nums text-ink-2",
                      )}
                    >
                      +{lever.available - lever.earned}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
                      {COPY[lever.id].open(lever)}
                    </span>
                    <ArrowRight
                      size={15}
                      strokeWidth={1.75}
                      aria-hidden="true"
                      className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              ))}

              {done.map((lever) => (
                <li
                  key={lever.id}
                  data-reach-lever={lever.id}
                  data-reach-lever-done=""
                  className="flex items-center gap-3 px-3 py-1.5"
                >
                  <Check size={15} strokeWidth={2} aria-hidden="true" className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-3">
                    {COPY[lever.id].done}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-3">
                    {lever.earned} pts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <CountStrip totals={totals} />
    </section>
  );
}

/**
 * The dial.
 *
 * `role="img"` with a written label rather than letting the `<text>` nodes be read: an SVG's text
 * children are announced in document order with no relationship to one another, so a reader hears
 * "55" then "REACH SCORE" as two unconnected strings. One label says the whole thing once.
 */
function ScoreDial({ score: given }: { score: number | null }): ReactElement {
  /* ⚠ A non-finite score is drawn as no score. `?? ""` and `?? "—"` catch only null, so a `NaN`
     from upstream reached the DOM as `data-reach-dial="NaN"` and a "NaN" in the dial — which
     React reports, and which reads to the owner as a measurement. */
  const score = typeof given === "number" && Number.isFinite(given) ? given : null;
  /* An unscored account draws an empty track — never a full ring at zero, which reads as a
     measured failure rather than as "not started". */
  const drawn = score === null ? 0 : CIRCUMFERENCE * (score / 100);

  return (
    <svg
      data-reach-dial={score ?? ""}
      width="136"
      height="136"
      viewBox="0 0 136 136"
      role="img"
      aria-label={score === null ? "No reach score yet" : `Reach score ${score} out of 100`}
      className="shrink-0"
    >
      <circle
        cx="68"
        cy="68"
        r={RADIUS}
        fill="none"
        className="stroke-surface-sunk"
        strokeWidth="13"
      />
      {score === null ? null : (
        <circle
          /* The sweep. `--cb-dial-len` is the arc's own length, which `globals.css` §6 animates
             the offset down from — so the dial draws itself to whatever the score happens to be
             rather than to a length baked into the stylesheet. Reduced motion is handled
             centrally by zeroing `--dur-slow`; see the note beside the keyframe. */
          data-reach-dial-arc=""
          style={{ "--cb-dial-len": drawn } as CSSProperties}
          cx="68"
          cy="68"
          r={RADIUS}
          fill="none"
          className="stroke-accent"
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={`${drawn} ${CIRCUMFERENCE}`}
          transform="rotate(-90 68 68)"
        />
      )}
      <text
        x="68"
        y="66"
        textAnchor="middle"
        aria-hidden="true"
        className="fill-ink [font-size:36px] [font-variant-numeric:tabular-nums] [letter-spacing:-1.4px]"
        fontWeight="600"
      >
        {score ?? "—"}
      </text>
      <text
        x="68"
        y="84"
        textAnchor="middle"
        aria-hidden="true"
        className="fill-ink-3 [font-size:9.5px] [letter-spacing:1.3px]"
        fontWeight="500"
      >
        REACH SCORE
      </text>
    </svg>
  );
}

/**
 * The two reach counts.
 *
 * Every count appears once on the dashboard. "Cards" and "Contacts" left this strip on
 * 2026-09-28 because the summary tiles above lead with them; "Not opened" and "Not told" are
 * levers above. Printing a number twice on one screen invites the reader to reconcile the two,
 * which is exactly the trap the live data is already caught in, with `behind: 3` sitting beside
 * `peopleReached: 2`.
 */
function CountStrip({ totals }: { totals: DashboardTotals }): ReactElement {
  const items = [
    { label: "People reached", value: totals.peopleReached },
    { label: "Opens", value: totals.totalOpens },
  ];

  return (
    /* A rule, not a box. Nested borders inside the panel's own border read as two objects
       where there is one, which is the "everything is a card" failure one level down. */
    <dl data-reach-counts="" className="-mx-1 flex flex-wrap border-t border-line pt-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            "flex min-w-[84px] flex-1 flex-col gap-0.5 px-3",
            i > 0 && "border-l border-line",
          )}
        >
          <dt className="text-overline uppercase text-ink-3">{item.label}</dt>
          {/* `null` is a count the API did not send (see `readDashboardTotals`): a dash, never 0. */}
          <dd className="text-lg font-semibold tabular-nums text-ink">
            {item.value ?? (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">Not available</span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

import Link from "next/link";

import { Badge } from "@/components/primitives";
import type { Attention } from "@/lib/dashboard/metrics";

/**
 * The four states worth acting on, worst first.
 *
 * ## Why this replaced "Recent contacts"
 * A reverse-chronological list of names answers no question. The owner added those contacts —
 * seeing them again on the dashboard tells them nothing they can do anything about, and it was
 * the largest block on the screen. Every row here has an action attached and a link to the
 * screen where the action lives, which is what earns space on a dashboard.
 *
 * A card in good standing produces **no row**. An empty list is the healthy state and says so.
 */

const COPY: Record<Attention["kind"], { tone: "warning" | "neutral"; label: string; say: (n: number) => string }> = {
  "no-fields": {
    tone: "warning",
    label: "Empty",
    say: () => "Shares nothing — anyone who scans it gets only your name.",
  },
  behind: {
    tone: "warning",
    label: "Not told",
    say: (n) => `${n} ${n === 1 ? "recipient hasn't" : "recipients haven't"} been told it changed.`,
  },
  "never-opened": {
    tone: "neutral",
    label: "Unopened",
    say: (n) => `${n} ${n === 1 ? "person hasn't" : "people haven't"} opened their link yet.`,
  },
  "never-shared": {
    tone: "neutral",
    label: "Unshared",
    say: () => "Nobody has this card yet.",
  },
};

export interface AttentionListProps {
  rows: readonly Attention[];
}

export function AttentionList({ rows }: AttentionListProps) {
  return (
    <section data-dashboard-region="attention" aria-labelledby="attention-heading">
      <h2 id="attention-heading" className="text-overline uppercase text-ink-3">
        Needs attention
      </h2>

      {rows.length === 0 ? (
        <p data-attention-clear="" className="mt-5 text-sm text-ink-3">
          Nothing to do — every card has fields, everyone who has one has opened it, and no
          recipient is behind on a change.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col">
          {rows.map((row) => {
            const copy = COPY[row.kind];
            return (
              <li
                key={`${row.kind}:${row.cardId}`}
                data-attention-row={row.kind}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line py-3 last:border-b-0"
              >
                <Link
                  href={`/cards/${row.cardId}`}
                  className="min-w-0 truncate text-base text-ink underline-offset-4 hover:underline"
                >
                  {row.cardName}
                </Link>
                <Badge tone={copy.tone}>{copy.label}</Badge>
                {/* ⚠ `basis-full` on a phone: the sentence always takes its own line at the
                    full measure, under the name and badge rather than starting after them.
                    As a plain wrapping item it began in whatever gap the badge left — often
                    40px — and then wrapped, so a 60-character sentence set as a one-word
                    orphan followed by three full lines. Its own line is both shorter and
                    readable. From `sm` up there is room to sit inline and it does. */}
                <span className="basis-full text-sm text-ink-3 sm:basis-auto">
                  {copy.say(row.count)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

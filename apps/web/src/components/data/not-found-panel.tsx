import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { buttonClassName } from "@/components/primitives/button";

/**
 * The not-found surface (spec §8D.3 card detail, §8D.5 public card): **a dedicated panel,
 * never a raw 404 and never an empty state.**
 *
 * The distinction matters and §8D.3 spells it out: an invalid `cardId` is not "you have
 * no cards", and it is not an error the reader can retry — retrying a wrong URL just
 * fails again. So there is no `Try again` here, and no `onRetry` prop to add one. The
 * only affordance is a way back to somewhere that exists.
 *
 * The status code itself is deliberately absent from the copy. "404" tells a person
 * nothing; "This card doesn't exist or was removed" tells them everything.
 *
 * Server-safe by design — `not-found.tsx` is a server component and this must not drag a
 * client boundary into it.
 */

export interface NotFoundPanelProps {
  overline?: string;
  title?: string;
  detail?: ReactNode;
  /** Where back is. `/dashboard` in the app, `/` on public routes. */
  backHref?: string;
  backLabel?: string;
  headingLevel?: 1 | 2 | 3;
  className?: string;
}

export function NotFoundPanel({
  overline = "Not found",
  title = "We couldn't find that",
  detail = "It may have been removed, or the link may be wrong.",
  backHref = "/dashboard",
  backLabel = "Go to dashboard",
  headingLevel = 2,
  className,
}: NotFoundPanelProps) {
  const Heading = headingLevel === 1 ? "h1" : headingLevel === 3 ? "h3" : "h2";

  return (
    <section
      data-not-found-panel=""
      className={cn(
        "mx-auto w-full max-w-[480px] rounded-lg border border-line bg-surface px-5 py-8 sm:px-8 sm:py-10",
        className,
      )}
    >
      <div data-prose className="flex flex-col gap-3">
        <p className="text-overline uppercase text-ink-3">{overline}</p>
        <Heading className="text-h3 text-ink">
          {title}
        </Heading>
        <p className="text-base text-ink-3">{detail}</p>
        <div className="mt-3 flex">
          <Link href={backHref} className={buttonClassName({ variant: "secondary" })}>
            {backLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

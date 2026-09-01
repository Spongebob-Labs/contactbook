"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Button, buttonClassName } from "@/components/primitives/button";

/**
 * The **first-run** empty state (spec §8D.1): the collection is genuinely empty, and the
 * screen offers the one action that resolves that.
 *
 * It is a separate component from `EmptyFilteredState` and must stay one. Conflating the
 * two is the classic this build is explicitly banned from repeating — a user who filtered
 * to nothing being told to "create your first card" is the exact failure AC-24 checks
 * for. The two are told apart by `data-empty-state`, not by their copy.
 *
 * **No illustration, no emoji, no icon in a tinted rounded square** (§8C, F-06/F-07/F-15).
 * A zero state earns its place with type and restraint: an overline, one line of display
 * type, one sentence of explanation, one action. Left-aligned by default, because
 * centred-everything with a vector in the middle is the loudest generated-UI tell there
 * is.
 */

export interface StateActionSpec {
  label: string;
  /** Navigates. Renders a real `<a>`, never a button that pushes a route. */
  href?: string;
  /** In-place action. Ignored when `href` is set. */
  onClick?: () => void;
}

/**
 * One action, rendered as a link when it navigates and a button when it does not.
 * Shared by both empty states and the not-found panel so all three agree.
 */
export function StateAction({
  action,
  variant,
}: {
  action: StateActionSpec;
  variant: "primary" | "secondary";
}) {
  if (action.href) {
    return (
      <Link href={action.href} className={buttonClassName({ variant })}>
        {action.label}
      </Link>
    );
  }
  return (
    <Button variant={variant} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

export interface EmptyStateProps {
  /** `--text-overline` kicker above the title. */
  overline?: string;
  title: string;
  /** One sentence. Say what the reader gets, or how the thing arrives. */
  description?: ReactNode;
  /** The primary action that resolves the emptiness. */
  action?: StateActionSpec;
  /** A quieter alternative — "Browse templates", say. */
  secondaryAction?: StateActionSpec;
  /** Extra explanation beneath the copy. */
  children?: ReactNode;
  /** Match the surrounding outline; the axe sweep checks heading order (AC-25). */
  headingLevel?: 2 | 3;
  align?: "start" | "center";
  className?: string;
}

export function EmptyState({
  overline = "Nothing here yet",
  title,
  description,
  action,
  secondaryAction,
  children,
  headingLevel = 2,
  align = "start",
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <div
      data-empty-state="first-run"
      className={cn(
        "w-full rounded-lg border border-line bg-surface px-8 py-12",
        align === "center" && "text-center",
        className,
      )}
    >
      <div
        data-prose
        className={cn("flex flex-col gap-3", align === "center" && "mx-auto items-center")}
      >
        <p className="text-overline uppercase text-ink-3">{overline}</p>
        <Heading className="text-h3 text-ink">{title}</Heading>
        {description ? <p className="text-base text-ink-3">{description}</p> : null}
        {children}
        {action || secondaryAction ? (
          <div
            className={cn(
              "mt-3 flex flex-wrap items-center gap-3",
              align === "center" && "justify-center",
            )}
          >
            {action ? <StateAction action={action} variant="primary" /> : null}
            {secondaryAction ? <StateAction action={secondaryAction} variant="secondary" /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

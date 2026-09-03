"use client";

import Link from "next/link";

import { cn } from "@/lib/cn";
import { Button, buttonClassName } from "@/components/primitives/button";
import type { FixtureError } from "@/types/domain";

/**
 * The error / offline family (spec §6.10, §8D.1). One implementation, used by every
 * `error.tsx` boundary in the application and by every inline partial failure — T09's
 * `(app)/error.tsx` and T14's root `error.tsx` both import this rather than re-writing
 * the panel, so the shape is identical everywhere by construction.
 *
 * The §6.10 anatomy, in order:
 *
 *     overline   "SOMETHING WENT WRONG"
 *     display-3  title            e.g. "We couldn't load your cards"
 *     body       detail           one sentence saying what to do
 *     button     "Try again"      only when retryable
 *     link       "Go to dashboard" / "Go home" on public routes
 *     caption    digest           only when present, muted, selectable
 *
 * **No stack traces, no raw messages, no error codes as headlines.** That is not a style
 * preference: a thrown `Error` in this application may carry a user's email or a field
 * value in its message, and §13.1 forbids PII in anything the user or a log ever sees.
 * The panel therefore takes copy, never an `Error` — `boundaryErrorPanelProps` is the
 * sanctioned adapter for the one place an `Error` exists.
 *
 * The §13.1 console line lives here too (`logBoundaryError`), for the same reason and in
 * the same spirit: the two decisions about what a thrown object may contribute — to the
 * DOM, and to the developer's console — belong beside each other rather than copied into
 * thirteen boundaries, which is how they drifted apart in the first place.
 *
 * Two variants, because §8D.1 says a **partial failure renders what succeeded** plus an
 * inline banner. A whole-page error where three of four regions loaded is a bug.
 */

export interface ErrorPanelProps {
  /** Straight from `useFixture`. Supplies title, detail and retryable at once. */
  error?: FixtureError | null;
  /** Used when there is no `error`, or to override one of its lines. */
  title?: string;
  detail?: string;
  retryable?: boolean;
  overline?: string;
  /** Wired to the boundary's `reset()`. Without it there is nothing to try again. */
  onRetry?: () => void;
  retryLabel?: string;
  /** `/dashboard` inside the app, `/` on public routes (§6.10). */
  homeHref?: string;
  homeLabel?: string;
  /** Next's boundary digest. Rendered muted and selectable so it can be quoted. */
  digest?: string;
  /** `page` = the centred panel; `inline` = the partial-failure banner. */
  variant?: "page" | "inline";
  headingLevel?: 1 | 2 | 3;
  className?: string;
}

const DEFAULT_TITLE = "We couldn't load this";
const DEFAULT_DETAIL = "Something went wrong on our side. Try again in a moment.";

/**
 * Turn an error-boundary argument into panel copy, keeping the digest and discarding
 * everything else — `message`, `stack`, `cause`, `name`. Nothing a thrown object carries
 * is safe to render (§13.1), and the digest is the only part that helps anyone.
 */
export function boundaryErrorPanelProps(
  error?: (Error & { digest?: string }) | null,
): Pick<ErrorPanelProps, "title" | "detail" | "retryable" | "digest"> {
  return {
    title: DEFAULT_TITLE,
    detail: "This page didn't finish loading. Try again — if it keeps happening, go back and start over.",
    retryable: true,
    digest: error?.digest,
  };
}

/**
 * §13.1 fixes the scope vocabulary at four values. A boundary that invents a fifth makes
 * the field unsearchable, which is how `scope: 'card-detail'` came to be logged for a
 * crash in the card *builder* — see `logBoundaryError` below.
 */
export type BoundaryLogScope = "app" | "auth" | "marketing" | "public-card";

/** The object `logBoundaryError` prints. Four fields, none of which can carry user data. */
export interface BoundaryLogPayload {
  scope: BoundaryLogScope;
  /** The route the failure came from, as the §13.1 sample writes it. */
  route: string;
  /** `error.name` — `TypeError`, `RangeError`. A constructor name, never user data. */
  name: string;
  /** Next's digest. Server-assigned, so `undefined` for a throw on the client. */
  digest?: string;
}

/**
 * The structured line every `error.tsx` in the build writes (spec §13.1). Thirteen
 * boundaries, one shape, and one place where the production/development split is decided.
 *
 * ── The recorded defect this exists to close ─────────────────────────────────────────
 * A real crash under `next dev` printed **`[contactbook] {}`** and nothing else. The
 * boundaries logged `{ scope, route, digest }` with `scope` and `route` hard-coded per
 * file, so `digest` was the only live field — and `digest` is assigned by the server when
 * it serialises a production error, which means it is absent for exactly the failures a
 * developer is looking at while they work. The line proved that *a* boundary had fired
 * and refused to say anything more. Thirteen copies of that shape were thirteen places to
 * get it wrong, which is why the shape now lives here instead of in each file.
 *
 * ── Why `message` and `stack` are development-only, rather than simply forbidden ──────
 * §13.1 prints `message` in its own sample and forbids PII in a log in the same section,
 * and every boundary in this build resolved the contradiction in favour of the rule: a
 * thrown `Error` here can carry a field value — an email address, a phone number, an
 * account label — and none of that is safe in anything that ships.
 *
 * That argument is about a **production log sink**: something durable, aggregated, and
 * readable by people the data does not belong to. `next dev`'s console is not one. It is
 * a stream on the developer's own machine, alive for as long as the tab is, printing
 * fixture values that are already on the screen behind it. Withholding the message there
 * buys no privacy at all and costs the whole diagnostic value of the line, so the split
 * is by build, not by field: production carries `scope`, `route`, `name` and `digest` and
 * nothing a throw authored, and development adds `message` and `stack` on top.
 *
 * `name` is safe on both sides and earns its place: `TypeError` versus `ChunkLoadError`
 * says what *kind* of failure this was without the reader having to reproduce it, and a
 * constructor name is not user data.
 *
 * ── Why boundaries call this rather than `console.error` directly ─────────────────────
 * Not only to delete twelve duplicates. It keeps `error.message` out of every `error.tsx`
 * under `src/app/**`, so the source-level grep that proves no boundary reaches into a
 * thrown object (`tests/unit/marketing-chrome.test.tsx`) still means what it says: the
 * single file that does reach in is this one, next to the adapter that already decides
 * what a thrown object is allowed to contribute to the panel. `ErrorPanel`'s copy is
 * unaffected either way — nothing below is ever rendered.
 */
export function logBoundaryError(
  error: (Error & { digest?: string }) | null | undefined,
  { scope, route }: { scope: BoundaryLogScope; route: string },
): void {
  /**
   * ⚠ `message`, `stack` and `cause` are absent, and a `NODE_ENV` gate is NOT enough to let
   * them in. That was tried and reverted:
   *
   * · **§13.1 forbids PII in a log, and a developer console is a log.** An `Error` in this
   *   product routinely carries a field value — `"could not load priyanka@example.com's card"`
   *   is the shape `marketing-chrome.test.tsx` pins down. Consoles get screenshotted into
   *   tickets and pasted into chat, so "development only" is not a containment boundary.
   * · **`NODE_ENV !== 'production'` is not the test either.** Under Vitest it is `test`, in CI
   *   it is whatever the runner sets, and the guard silently opened in both.
   * · **Nothing is lost.** React already prints the caught error, with its message and full
   *   stack, to the console on its own. This line exists to *correlate* that — which surface,
   *   which route, which digest — not to restate it. Duplicating the text bought nothing and
   *   cost the one guarantee §13.1 asks for.
   *
   * `name` is a constructor name (`TypeError`, `RangeError`) and can never be user data, and
   * it is what stops this line being the `[contactbook] {}` that a client-side throw used to
   * print — `digest` is server-assigned and absent on the client, so before `name` and the
   * classified `scope` there was nothing here at all.
   */
  const payload: BoundaryLogPayload = {
    scope,
    route,
    name: error?.name ?? "Error",
    digest: error?.digest,
  };

  console.error("[contactbook]", payload);
}

/**
 * Which surface a failure came from, decided from the path alone.
 *
 * Pure, exported and table-tested rather than inlined in the boundary, for two reasons. It is
 * the only part of the root boundary with any logic in it, and testing it through a rendered
 * component means mutating `window.location` — which happy-dom does not honour via
 * `history.replaceState`, so the assertion silently measured the default `/` and passed the
 * wrong branch.
 *
 * The root boundary backstops **two** public surfaces: a route with no group of its own, and a
 * throw inside `(marketing)`'s or `/c/[slug]`'s own layout. The path is the only thing that can
 * tell them apart once the throw has escaped the group.
 */
export function boundaryScopeForPath(pathname: string): BoundaryLogScope {
  if (pathname.startsWith("/c/")) return "public-card";
  return "marketing";
}

export function ErrorPanel({
  error,
  title,
  detail,
  retryable,
  overline = "Something went wrong",
  onRetry,
  retryLabel = "Try again",
  homeHref = "/dashboard",
  homeLabel = "Go to dashboard",
  digest,
  variant = "page",
  headingLevel = 2,
  className,
}: ErrorPanelProps) {
  const resolvedTitle = title ?? error?.title ?? DEFAULT_TITLE;
  const resolvedDetail = detail ?? error?.detail ?? DEFAULT_DETAIL;
  const canRetry = (retryable ?? error?.retryable ?? false) && typeof onRetry === "function";
  const Heading = headingLevel === 1 ? "h1" : headingLevel === 3 ? "h3" : "h2";

  if (variant === "inline") {
    // The partial-failure banner. It sits beside content that DID load, so it offers no
    // navigation away from that content — only the retry.
    return (
      <div
        role="alert"
        data-error-panel="inline"
        className={cn(
          "flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-danger-wash px-4 py-3",
          className,
        )}
      >
        <div data-prose className="min-w-0 flex-1">
          <p className="text-sm text-danger">{resolvedTitle}</p>
          <p className="text-sm text-danger">{resolvedDetail}</p>
        </div>
        {canRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <section
      role="alert"
      data-error-panel="page"
      className={cn(
        // Flat, hairline-framed, no elevation — separation is the rule, not a shadow
        // (§8.7). 480px per §6.10.
        "mx-auto w-full max-w-[480px] rounded-lg border border-line bg-surface px-5 py-8 sm:px-8 sm:py-10",
        className,
      )}
    >
      <div data-prose className="flex flex-col gap-3">
        <p className="text-overline uppercase text-ink-3">{overline}</p>
        <Heading className="text-h3 text-ink">{resolvedTitle}</Heading>
        <p className="text-base text-ink-3">{resolvedDetail}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {canRetry ? <Button onClick={onRetry}>{retryLabel}</Button> : null}
          <Link href={homeHref} className={buttonClassName({ variant: "text-link" })}>
            {homeLabel}
          </Link>
        </div>
        {digest ? (
          <p data-error-digest="" className="mt-2 text-xs text-ink-3 select-all">
            {digest}
          </p>
        ) : null}
      </div>
    </section>
  );
}

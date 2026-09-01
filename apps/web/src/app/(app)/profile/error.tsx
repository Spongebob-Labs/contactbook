"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { ErrorPanel, boundaryErrorPanelProps, logBoundaryError } from "@/components/data";

/**
 * The `/profile` route boundary (spec §6.1 R-16, §6.10, §13.1).
 *
 * It sits below `(app)/error.tsx`, so a throw inside the profile is caught here and the
 * rail, the bottom bar and the main region keep rendering around it — a failure never
 * costs the owner their navigation.
 *
 * **`error.message` is never rendered, and on this route that is not a formality.** The
 * objects this screen throws over are `ProfileField`s: phone numbers, home addresses, a
 * bank account. A thrown `Error` can carry any of them in its message, and §13.1 forbids
 * PII on any surface a user or a log ever sees. `boundaryErrorPanelProps` keeps the
 * `digest` and discards `message`, `stack`, `cause` and `name`; the digest renders muted
 * and selectable, which is enough to find the failure from a screenshot. The structured
 * console line carries `scope` / `route` / `digest` and deliberately no message either.
 *
 * `retry()` (stable in Next 16.3) re-fetches *and* re-renders the segment; `reset()` only
 * clears the boundary. "Try again" means the former, so `retry` is preferred and `reset`
 * is the fallback — both optional, so the panel degrades to a link rather than throwing if
 * a future runtime drops one.
 */

export interface ProfileErrorProps {
  error: Error & { digest?: string };
  /** Next 16.3+. Re-fetches and re-renders the segment. Preferred. */
  retry?: () => void;
  /** The older name, still passed by the runtime. Used when `retry` is absent. */
  reset?: () => void;
}

export default function ProfileError({ error, retry, reset }: ProfileErrorProps) {
  const route = usePathname();

  useEffect(() => {
    logBoundaryError(error, { scope: "app", route });
  }, [error, route]);

  return (
    <div className="py-12">
      <ErrorPanel
        {...boundaryErrorPanelProps(error)}
        headingLevel={1}
        onRetry={retry ?? reset}
        homeHref="/dashboard"
        homeLabel="Go to dashboard"
      />
    </div>
  );
}

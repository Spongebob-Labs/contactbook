"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { ErrorPanel, boundaryErrorPanelProps, logBoundaryError } from "@/components/data";

/**
 * The `/profile/groups/[groupId]` route boundary (spec §6.1 R-17, §6.10, §13.1).
 *
 * The same discipline as `/profile`'s, for the same reason: this screen throws over
 * `ProfileField`s, so a thrown `Error`'s `message` may carry a home address or an account
 * number. `boundaryErrorPanelProps` keeps the `digest` and discards `message`, `stack`,
 * `cause` and `name`, and **`error.message` is never rendered**. The console line is
 * `scope` / `route` / `digest` — no message there either, because §13.1's "no PII in
 * `console`, ever" includes the browser console.
 *
 * "Back to profile" rather than "Go to dashboard": the reader was one level deep in their
 * own profile, and the useful way back is one level up, not four.
 */

export interface FieldGroupErrorProps {
  error: Error & { digest?: string };
  /** Next 16.3+. Re-fetches and re-renders the segment. Preferred. */
  retry?: () => void;
  /** The older name, still passed by the runtime. Used when `retry` is absent. */
  reset?: () => void;
}

export default function FieldGroupError({ error, retry, reset }: FieldGroupErrorProps) {
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
        homeHref="/profile"
        homeLabel="Back to profile"
      />
    </div>
  );
}

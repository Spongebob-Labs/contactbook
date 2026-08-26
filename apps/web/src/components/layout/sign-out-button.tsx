"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";

import { Tooltip } from "@/components/overlay";
import { auth } from "@/lib/api/browser";
import { cn } from "@/lib/cn";

/**
 * Sign out.
 *
 * ## Why this component did not exist until now
 * It should have from the moment the session became real. `signOutAction` was written and never
 * wired to anything, so the only way out was clearing cookies by hand — which is not a way out.
 *
 * ## Two steps, and the second always runs
 * 1. `POST /auth/logout` — revokes the refresh-token family upstream, so a stolen token is dead
 *    rather than merely forgotten.
 * 2. `/api/session/end` — a Route Handler, because clearing a cookie needs one. It deletes both
 *    session cookies and redirects to sign-in.
 *
 * ⚠ Step 2 runs **even if step 1 fails**. An expired token or an unreachable API must not trap
 * somebody in a session they asked to leave: the alternative is pressing "Sign out", seeing an
 * error, and still being signed in. The upstream token then lives until it expires, which is a
 * real but small cost, accepted knowingly — the button has to work.
 *
 * A full navigation rather than a client-side route change, deliberately: it discards every piece
 * of fetched state in memory along with the session, which is what signing out should mean.
 */
export function SignOutButton({
  className,
  labelClassName,
  compact = false,
}: {
  className?: string;
  /** Hides the word on a collapsed rail while keeping the accessible name. */
  labelClassName?: string;
  /** Renders as an icon with a tooltip, for the collapsed rail. */
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      try {
        await auth.logout();
      } catch {
        // Deliberately swallowed — see the note above.
      }
      window.location.assign("/api/session/end");
    });
  }

  const button = (
    <button
      type="button"
      data-sign-out=""
      aria-label="Sign out"
      aria-busy={pending}
      onClick={signOut}
      className={cn(
        "flex h-10 min-w-0 items-center gap-3 rounded-full text-sm",
        "text-ink-3 transition-colors duration-[var(--dur-fast)] ease-out",
        "hover:bg-surface hover:text-ink",
        className,
      )}
    >
      <LogOut aria-hidden="true" strokeWidth={1.5} className="size-6 shrink-0" />
      <span className={cn("truncate", labelClassName)}>
        {pending ? "Signing out…" : "Sign out"}
      </span>
    </button>
  );

  // On a collapsed rail the word is hidden, so the tooltip carries it — same treatment the nav
  // items get, so the rail reads consistently at every width.
  return compact ? <Tooltip content="Sign out">{button}</Tooltip> : button;
}

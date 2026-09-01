import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { SkipLink } from "@/components/layout/skip-link";
import { ToastProvider } from "@/components/overlay";
import type { User } from "@/types/domain";
import { SessionProvider } from "@/lib/session-context";

/**
 * Everything `(app)` wraps every authenticated route in — the providers and the shell, with no
 * data fetching of its own.
 *
 * ## Why this is separate from `(app)/layout.tsx`
 * The layout became `async` when the session became real: it awaits `GET /profile/me`, redirects
 * an unfinished profile into `/signup`, and only then renders. That makes the layout untestable
 * as a unit — you cannot assert "the skip link is the first focusable element" against a
 * component that first needs a network round trip and a cookie jar.
 *
 * Splitting them puts each concern where it can be checked: the layout owns fetching and the two
 * redirects, this owns composition and tab order. The layout is thin enough to read at a glance,
 * which is the right shape for a file whose bugs are all authorisation bugs.
 *
 * ── Two mounts that are load-bearing for reasons unrelated to auth ───────────────────
 *
 * · **`ToastProvider`** (T08) — also mounts the overlay elevation stylesheet, the rule that turns
 *   `data-elevation="1"` into a real shadow. `primitives/select.tsx` portals its menu with that
 *   attribute and declares no shadow of its own, because a shadow outside
 *   `src/components/overlay/**` fails F-09. **Remove this provider and every `<Select>` on every
 *   authenticated route renders flat against the page** — a bug with no visible connection to
 *   this file. Mounted exactly once; never mount a second in a child route.
 *
 * · **`SkipLink`** — first in the DOM, therefore first in the tab order (AC-26). It targets the
 *   `<main id="main" tabIndex={-1}>` that `AppShell` renders.
 */
export function AppChrome({ user, children }: { user: User | null; children: ReactNode }) {
  return (
    <SessionProvider user={user}>
      <ToastProvider>
        <SkipLink />
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </SessionProvider>
  );
}

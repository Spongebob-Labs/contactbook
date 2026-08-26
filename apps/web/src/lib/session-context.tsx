"use client";

/**
 * The signed-in user, for client components.
 *
 * ## What this replaces
 * `fixture-auth.tsx` — which held a `User` in `useState`, was explicit that it was **not a
 * security boundary**, and guarded nothing. This is the real thing, and the difference is
 * where the value comes from: `(app)/layout.tsx` fetches it server-side from
 * `GET /profile/me` and passes it down. There is no client-side sign-in and no way to mutate
 * the user from here, because both would be lies — the session lives in an httpOnly cookie the
 * browser cannot read.
 *
 * ## Why the shape is unchanged
 * Consumers read `{ user }` and nothing else (`sidebar.tsx`, `nav-drawer.tsx`). Keeping that
 * exact shape is why swapping the real session in touched two import lines rather than two
 * components.
 *
 * ## Why `user` is still nullable
 * Inside `(app)` a null user should be unreachable — `proxy.ts` redirects an unauthenticated
 * request before the layout renders. But the sidebar's signed-out chip is a spec requirement
 * (§11 E-14: "renders the signed-out chip rather than an empty slot"), and a component that
 * degrades instead of throwing is worth more than a type that proves a guard I would rather not
 * bet the whole chrome on. So the contract matches the provider this replaced, exactly.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { User } from "@/types/domain";

export type SessionStatus = "signed-in" | "signed-out";

export interface SessionValue {
  status: SessionStatus;
  /** `null` only in the degraded case the sidebar's signed-out chip exists for. */
  user: User | null;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: User | null;
  children: ReactNode;
}) {
  // `useMemo` keyed on `user` alone: the object is otherwise rebuilt on every parent render,
  // which would invalidate every downstream memo that depends on the session.
  const value = useMemo<SessionValue>(
    () => ({ status: user === null ? "signed-out" : "signed-in", user }),
    [user],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * The signed-in user. Throws when no provider is mounted, because a silent `null` surfaces as
 * a blank name chip three screens away from the cause.
 */
export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error(
      "useSession must be used inside a <SessionProvider>. The (app) group mounts one in its layout.",
    );
  }
  return value;
}

/**
 * For surfaces that legitimately render on both sides of the session — the marketing chrome,
 * which shows "Sign in" or "Dashboard" depending on whether a provider happens to be above it.
 */
export function useOptionalSession(): SessionValue | null {
  return useContext(SessionContext);
}

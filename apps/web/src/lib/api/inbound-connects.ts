import type { InboundConnectsResponse } from "@/app/api/inbound/connects/route";

/**
 * Browser-side reader for the caller's inbound activity.
 *
 * ⚠ It calls **our own** `/api/inbound/connects`, not `/api/cb/inbound-messages`, and the
 * distinction is the whole safety story: the upstream endpoint is not ownership-scoped, so the
 * join against the caller's own contacts has to happen on the server. That route's header
 * carries the full reasoning; this file exists so no client component is ever tempted to
 * assemble the URL itself.
 *
 * ⚠ Resolves `null` on any failure rather than throwing. This powers one column and one filter
 * chip on a screen whose real subject is the registry — losing it should cost that column, not
 * the page. The registry's own loader already takes the same line with `shareCounts`.
 */
export async function fetchInboundConnects(): Promise<InboundConnectsResponse | null> {
  try {
    const response = await fetch("/api/inbound/connects", {
      /* Per-caller data behind a session cookie: never reuse a cached body. */
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as InboundConnectsResponse;
  } catch {
    return null;
  }
}

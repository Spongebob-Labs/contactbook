import type { ReactElement } from "react";

import { SeedDemoCard } from "./seed-demo-client";

/**
 * ⚠ **A DEVELOPMENT UTILITY. DELETE THIS ROUTE BEFORE MERGE.**
 *
 * One button that builds a card carrying everything the redesigned card page can render — every
 * profile field, a logo, a cover, a position and a bio, on the Ivory theme — so the design can be
 * judged against real data instead of a fixture.
 *
 * ## Why a button and not a `useEffect`
 *
 * It writes to the owner's real account: it creates a card, uploads a file and ticks every field
 * they have. That is not something a page should do because somebody opened a URL — a refresh
 * would make a second card, and a mistyped link would make one for no reason at all. One
 * deliberate press, once, and the result is a card like any other: rename it, edit it, or delete
 * it from `/cards`.
 */
export default function SeedDemoPage(): ReactElement {
  return <SeedDemoCard />;
}

/**
 * Which routes run in **focus mode** — the chrome-less shape the card builder wears.
 *
 * ## Why this is one predicate in its own file
 *
 * Two components have to agree about it and they cannot ask each other: `AppShell` decides
 * whether to render the persistent rail and the bottom bar, and `BuilderHeader` decides whether
 * to render the hamburger that brings the rail back. If those two ever disagree the result is
 * silent and bad in both directions — a builder with no navigation and no way to reach any, or a
 * hamburger sitting next to the rail it claims to open.
 *
 * So the rule is written once, here, and both read it. Neither imports the other.
 *
 * ## Why the builder loses the chrome at all
 *
 * The builder is not a screen in the product; it is an **editor over one object**. It already
 * spends its width on three things that all need it — a section rail, a panel of controls and a
 * live phone — and a second, unrelated rail down the left of that competes with the first for
 * exactly the same reading. Every editor of this kind drops the app's own navigation while you
 * are inside it and offers a way back; that is what this is.
 *
 * Nothing is unreachable. The drawer holds the same `APP_NAV_ITEMS` in the same order, and on a
 * phone the builder keeps the bottom bar, because there the rail was never on screen to begin
 * with and removing the bar would be removing navigation that costs the editor nothing.
 */

/**
 * `/cards/new` and `/cards/{id}/edit`, and nothing else.
 *
 * ⚠ Anchored at both ends and deliberately narrow. A `startsWith("/cards/")` would sweep
 * `/cards/{id}` — the card's *detail* screen, an ordinary destination with a back link and no
 * editor — into focus mode and strip the navigation off it. The two `edit` segments are the
 * whole membership, so the pattern names them.
 */
const FOCUS_ROUTES = /^\/cards\/(?:new|[^/]+\/edit)\/?$/;

export function isFocusRoute(pathname: string | null): boolean {
  return pathname !== null && FOCUS_ROUTES.test(pathname);
}

/**
 * The authenticated chrome (spec §8D.3, §8D.4, §8D.7).
 *
 * Six wave-7 screen tracks render inside `AppShell`, so three of its rules are contracts
 * rather than implementation details:
 *
 * · **`AppShell` owns the one `<main id="main">`.** Never render a second `<main>` — not
 *   directly and not via `<ScreenStateRoot as="main">`. Two `main` landmarks fail axe's
 *   `landmark-unique` (AC-25).
 * · **`SkipLink` is mounted once, by `(app)/layout.tsx`, ahead of everything.** It is the
 *   first focusable element on every authenticated route (AC-26) and it targets `#main`.
 * · **The rail↔bottom-bar swap is CSS, not JavaScript.** Do not add a width branch on top
 *   of it; §11 E-45 is exactly the failure that causes.
 *
 * `SplitView` is the geometry the card builder consumes (§8D.4): pinned pane first in DOM
 * order at every width, `sticky` at every width, ~46/54 above 1024px.
 */

export { AppShell } from "./app-shell";
export type { AppShellProps } from "./app-shell";

export { Sidebar, APP_NAV_ITEMS, isAppNavItemActive, isNavItemActive } from "./sidebar";
export type { AppNavItem, SidebarProps } from "./sidebar";

/* Focus mode: the predicate `AppShell` and `BuilderHeader` both read, and the drawer that is
   the way back out of it. Exported together — a hamburger with no predicate behind it opens a
   rail that never left. */
export { isFocusRoute } from "./focus-route";
export { NavDrawer } from "./nav-drawer";

export { BrandLogo } from "./brand-logo";
export type { BrandLogoProps } from "./brand-logo";

export { BottomBar } from "./bottom-bar";
export type { BottomBarProps } from "./bottom-bar";

export { PageHeader } from "./page-header";
export type { PageHeaderProps } from "./page-header";

export { SplitView } from "./split-view";
export type { SplitViewProps } from "./split-view";

export { SkipLink } from "./skip-link";
export type { SkipLinkProps } from "./skip-link";

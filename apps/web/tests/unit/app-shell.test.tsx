import { describe, expect, it, vi, beforeEach } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "../helpers/render";
import * as barrel from "@/components/layout";
import { AppShell } from "@/components/layout/app-shell";
import { BottomBar } from "@/components/layout/bottom-bar";
import { PageHeader } from "@/components/layout/page-header";
import { isFocusRoute } from "@/components/layout/focus-route";
import { APP_NAV_ITEMS, Sidebar, isNavItemActive } from "@/components/layout/sidebar";
import { SkipLink } from "@/components/layout/skip-link";
import { SplitView } from "@/components/layout/split-view";
import AppGroupError from "@/app/(app)/error";
import { AppChrome } from "@/components/layout/app-chrome";
import { OVERLAY_STYLE_HREF } from "@/components/overlay";
import { boundaryErrorPanelProps } from "@/components/data";
import { SessionProvider, useSession } from "@/lib/session-context";
import { useToast } from "@/components/overlay";
import { extremeUserLongName } from "@/fixtures/extremes";
// The provider now takes the user as a prop rather than defaulting to it internally, so the
// tests name the user they are rendering with. Same user the fixture provider used to seed.
import { fixtureUser } from "@/fixtures/user";

/**
 * The app-shell contract suite (T09).
 *
 * The shell is the spine of the authenticated product: six wave-7 screen tracks render
 * inside it, so its DOM contract has to be settled before they start. What this file
 * proves is **structure, ARIA and the class contract that expresses the responsive
 * rules** — AC-26 (the skip link), E-14 (the 40+ char user chip) and E-45 (crossing the
 * mobile breakpoint).
 *
 * ⚠ happy-dom has no layout engine and no stylesheet (spec §14.6). "The sidebar stays
 * exactly 240px" cannot be measured here and is not attempted: what is asserted is that
 * the width comes from `--sidebar-width` and that nothing in the component can widen it.
 * The rendered proof is Playwright's, in T29's `keyboard.spec.ts` and `a11y.spec.ts`.
 */

/* `usePathname` is what decides the active nav item, so the suite drives it directly. */
const pathname = vi.hoisted(() => ({ current: "/dashboard" as string | null }));

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, usePathname: () => pathname.current };
});

beforeEach(() => {
  pathname.current = "/dashboard";
});

/** Everything the browser puts in the tab order, in document order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function renderSidebar(ui = <Sidebar />) {
  return renderWithProviders(<SessionProvider user={fixtureUser}>{ui}</SessionProvider>);
}

describe("SkipLink (AC-26)", () => {
  it("is an anchor to #main with a real accessible name", () => {
    renderWithProviders(<SkipLink />);

    const link = screen.getByRole("link", { name: /skip to content/i });
    expect(link).toHaveAttribute("href", "#main");
  });

  it("is the FIRST focusable element of the shell, ahead of the sidebar", () => {
    const { container } = renderWithProviders(
      <SessionProvider user={fixtureUser}>
        <SkipLink />
        <AppShell>
          <p>page</p>
        </AppShell>
      </SessionProvider>,
    );

    const first = container.querySelectorAll(FOCUSABLE)[0];
    expect(first).toHaveAttribute("href", "#main");
  });

  it("never reimplements the global focus ring (T02 owns it, AC-26)", () => {
    renderWithProviders(<SkipLink />);

    const cls = screen.getByRole("link", { name: /skip to content/i }).className;
    expect(cls).not.toMatch(/\boutline-/);
    expect(cls).not.toMatch(/\bring-/);
    expect(cls).not.toMatch(/focus(-visible)?:outline/);
  });

  it("stays in the accessibility tree when unfocused — hidden by transform, not display", () => {
    renderWithProviders(<SkipLink />);

    const cls = screen.getByRole("link", { name: /skip to content/i }).className;
    expect(cls).toMatch(/-translate-y-/);
    expect(cls).not.toMatch(/\bhidden\b/);
  });
});

describe("Sidebar nav (spec §8D.3)", () => {
  it("declares exactly four items, in order, with the §8D.3 routes", () => {
    expect(APP_NAV_ITEMS.map((item) => [item.label, item.href])).toEqual([
      ["Dashboard", "/dashboard"],
      ["Cards", "/cards"],
      ["Contacts", "/contacts"],
      ["Profile", "/profile"],
    ]);
  });

  it("renders exactly four nav links and nothing else inside the nav landmark", () => {
    renderSidebar();

    const nav = screen.getByRole("navigation", { name: /primary/i });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
  });

  it("marks the current route with aria-current=page and the --accent-wash pill", () => {
    pathname.current = "/cards";
    renderSidebar();

    const cards = screen.getByRole("link", { name: "Cards" });
    expect(cards).toHaveAttribute("aria-current", "page");
    expect(cards.className).toMatch(/bg-accent-wash/);
    expect(cards.className).toMatch(/text-accent/);
    expect(cards.className).toMatch(/rounded-full/);

    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the parent item active on a child route, and only that item", () => {
    pathname.current = "/cards/card_kestrel/edit";
    renderSidebar();

    expect(screen.getByRole("link", { name: "Cards" })).toHaveAttribute("aria-current", "page");
    for (const label of ["Dashboard", "Contacts", "Profile"]) {
      expect(screen.getByRole("link", { name: label })).not.toHaveAttribute("aria-current");
    }
  });

  it("does not treat a prefix collision as a match", () => {
    expect(isNavItemActive("/cards", "/cards")).toBe(true);
    expect(isNavItemActive("/cards/card_1", "/cards")).toBe(true);
    expect(isNavItemActive("/cards-archive", "/cards")).toBe(false);
    expect(isNavItemActive(null, "/cards")).toBe(false);
  });
});

describe("Sidebar collapse (spec §8D.3, §10.1)", () => {
  it("starts in the CSS-driven auto state — expanded ≥1024px, collapsed on tablet", () => {
    const { container } = renderSidebar();

    const aside = container.querySelector("[data-app-sidebar]");
    expect(aside).toHaveAttribute("data-collapsed", "auto");
    expect(aside?.className).toMatch(/w-\[var\(--sidebar-collapsed\)\]/);
    expect(aside?.className).toMatch(/lg:w-\[var\(--sidebar-width\)\]/);
  });

  it("collapses to data-collapsed=true and re-expands to false, in component state only", async () => {
    const user = userEvent.setup();
    const { container } = renderSidebar();
    const aside = container.querySelector("[data-app-sidebar]");

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    expect(aside).toHaveAttribute("data-collapsed", "true");
    expect(aside?.className).toMatch(/w-\[var\(--sidebar-collapsed\)\]/);
    expect(aside?.className).not.toMatch(/lg:w-\[var\(--sidebar-width\)\]/);

    await user.click(screen.getByRole("button", { name: /expand sidebar/i }));
    expect(aside).toHaveAttribute("data-collapsed", "false");
    expect(aside?.className).toMatch(/w-\[var\(--sidebar-width\)\]/);
  });

  it("keeps an aria-label on every nav item in every collapse state", async () => {
    const user = userEvent.setup();
    renderSidebar();

    for (const step of ["auto", "collapsed", "expanded"] as const) {
      if (step === "collapsed") {
        await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));
      }
      if (step === "expanded") {
        await user.click(screen.getByRole("button", { name: /expand sidebar/i }));
      }

      for (const item of APP_NAV_ITEMS) {
        expect(screen.getByRole("link", { name: item.label })).toHaveAttribute(
          "aria-label",
          item.label,
        );
      }
    }
  });

  it("never widens itself — the width is always a --sidebar-* token, never fluid", async () => {
    const user = userEvent.setup();
    const { container } = renderSidebar();
    const aside = container.querySelector("[data-app-sidebar]");

    for (const label of [/collapse sidebar/i, /expand sidebar/i]) {
      await user.click(screen.getByRole("button", { name: label }));
      const cls = aside?.className ?? "";
      expect(cls).toMatch(/(^|\s|:)w-\[var\(--sidebar-(width|collapsed)\)\]/);
      expect(cls).not.toMatch(/\bw-full\b/);
      expect(cls).not.toMatch(/\b(flex-1|grow|basis-)/);
    }
  });
});

describe("Sidebar user chip (§11 E-14)", () => {
  it("truncates a 40+ character name with an ellipsis instead of widening the rail", () => {
    const longName = `${extremeUserLongName.firstName} ${extremeUserLongName.lastName}`;
    expect(longName.length).toBeGreaterThan(40);

    const { container } = renderWithProviders(
      <SessionProvider user={extremeUserLongName}>
        <Sidebar />
      </SessionProvider>,
    );

    const name = container.querySelector("[data-user-chip-name]");
    expect(name).toHaveTextContent(longName);
    // `truncate` is overflow-hidden + text-ellipsis + whitespace-nowrap.
    expect(name?.className).toMatch(/\btruncate\b/);

    // Truncation only bites when the flex chain cannot grow past the rail.
    const chip = container.querySelector("[data-user-chip]");
    expect(chip?.className).toMatch(/\bmin-w-0\b/);
    expect(name?.parentElement?.className).toMatch(/\bmin-w-0\b/);

    // …and the rail itself is unchanged by the long name.
    expect(container.querySelector("[data-app-sidebar]")?.className).toMatch(
      /lg:w-\[var\(--sidebar-width\)\]/,
    );
  });

  it("renders the signed-out chip rather than an empty slot", () => {
    const { container } = renderWithProviders(
      <SessionProvider user={null}>
        <Sidebar />
      </SessionProvider>,
    );

    expect(container.querySelector("[data-user-chip]")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/signin/phone",
    );
  });
});

describe("BottomBar (spec §8D.3, ≤767px)", () => {
  it("carries the same four destinations as the sidebar", () => {
    renderWithProviders(<BottomBar />);

    const nav = screen.getByRole("navigation", { name: /primary/i });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(
      APP_NAV_ITEMS.map((item) => item.href),
    );
  });

  it("marks the active destination and labels each item visibly", () => {
    pathname.current = "/contacts";
    renderWithProviders(<BottomBar />);

    expect(screen.getByRole("link", { name: "Contacts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // icon + --text-xs label, never an icon alone (§8.8, AC-25).
    for (const item of APP_NAV_ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toHaveTextContent(item.label);
    }
  });

  it("is a fixed 64px bar off the --bottombar-height token, clear of the home indicator", () => {
    const { container } = renderWithProviders(<BottomBar />);

    const bar = container.querySelector("[data-app-bottom-bar]");
    expect(bar?.className).toMatch(/\bfixed\b/);
    expect(bar?.className).toMatch(/border-t/);

    // 64px of content PLUS the inset, not 64px total: under `border-box` a bare
    // `h-[var(--bottombar-height)]` alongside the padding below would squeeze the items
    // into `64px - inset` and push their labels under the home indicator.
    expect(bar?.className).toContain(
      "h-[calc(var(--bottombar-height)+env(safe-area-inset-bottom))]",
    );
    expect(bar?.className).toContain("pb-[env(safe-area-inset-bottom)]");
  });
});

describe("AppShell (§11 E-45 — crossing the mobile breakpoint)", () => {
  it("renders exactly one <main id=\"main\"> and makes it a focus target", () => {
    const { container } = renderWithProviders(
      <SessionProvider user={fixtureUser}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </SessionProvider>,
    );

    const mains = container.querySelectorAll("main");
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAttribute("id", "main");
    expect(mains[0]).toHaveAttribute("tabindex", "-1");
    expect(mains[0]).toHaveTextContent("page");
  });

  it("swaps rail↔bar with mutually exclusive CSS, never a JS width branch", () => {
    const { container } = renderWithProviders(
      <SessionProvider user={fixtureUser}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </SessionProvider>,
    );

    const rail = container.querySelector("[data-app-sidebar]");
    const bar = container.querySelector("[data-app-bottom-bar]");

    // The rail is display:none below the bar's breakpoint, and vice versa — so exactly
    // one navigation is in the accessibility tree at every width (E-45).
    expect(rail?.className).toMatch(/\bhidden\b/);
    expect(rail?.className).toMatch(/\bmd:flex\b/);
    expect(bar?.className).toMatch(/\bmd:hidden\b/);
    expect(bar?.className).not.toMatch(/\bmd:flex\b/);
  });

  it("leaves no orphaned rail after collapsing — the mobile rule is unconditional", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(
      <SessionProvider user={fixtureUser}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </SessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    const rail = container.querySelector("[data-app-sidebar]");
    expect(rail).toHaveAttribute("data-collapsed", "true");
    expect(rail?.className).toMatch(/\bhidden\b/);
    expect(rail?.className).toMatch(/\bmd:flex\b/);
  });

  it("reserves the bottom bar's height plus the safe-area inset under the content", () => {
    const { container } = renderWithProviders(
      <SessionProvider user={fixtureUser}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </SessionProvider>,
    );

    const column = container.querySelector("[data-app-content]");
    expect(column?.className).toContain(
      "pb-[calc(var(--bottombar-height)+env(safe-area-inset-bottom))]",
    );
    expect(column?.className).toMatch(/\bmd:pb-0\b/);
  });

  it("caps the main region at --content-max", () => {
    const { container } = renderWithProviders(
      <SessionProvider user={fixtureUser}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </SessionProvider>,
    );

    expect(container.querySelector("main")?.className).toMatch(
      /max-w-\[var\(--content-max\)\]/,
    );
  });
});

describe("focus mode (the card builder's chrome)", () => {
  /**
   * ⚠ The predicate is tested apart from the shell because **two components read it** —
   * `AppShell` decides whether to render the rail, `BuilderHeader` decides whether to render the
   * hamburger that brings it back — and a disagreement between them is silent and bad in both
   * directions: a builder with no navigation, or a hamburger next to the rail it claims to open.
   */
  it.each([
    ["/cards/new", true],
    ["/cards/card_minimal_demo/edit", true],
    ["/cards/card_minimal_demo/edit/", true],
    /* ⚠ The card's own detail screen is NOT focus mode. It is an ordinary destination with a
       back link and no editor, and a `startsWith("/cards/")` would have swept it in and stripped
       the navigation off it — which is exactly why the pattern is anchored at both ends. */
    ["/cards/card_minimal_demo", false],
    ["/cards", false],
    ["/cards/card_minimal_demo/edit/extra", false],
    ["/dashboard", false],
    ["/profile", false],
  ])("isFocusRoute(%s) is %s", (route, expected) => {
    expect(isFocusRoute(route)).toBe(expected);
  });

  it("has no pathname to read before hydration, and is not focus mode then", () => {
    expect(isFocusRoute(null)).toBe(false);
  });

  it("drops the rail on a builder route and keeps it everywhere else", () => {
    pathname.current = "/dashboard";
    const { container: normal } = renderWithProviders(
      <SessionProvider user={fixtureUser}>
        <AppShell>screen</AppShell>
      </SessionProvider>,
    );
    expect(normal.querySelector("[data-app-sidebar]")).not.toBeNull();
    expect(normal.querySelector("[data-app-shell]")).toHaveAttribute("data-app-chrome", "full");

    pathname.current = "/cards/card_minimal_demo/edit";
    const { container: focused } = renderWithProviders(
      <SessionProvider user={fixtureUser}>
        <AppShell>screen</AppShell>
      </SessionProvider>,
    );
    expect(focused.querySelector("[data-app-sidebar]")).toBeNull();
    expect(focused.querySelector("[data-app-shell]")).toHaveAttribute("data-app-chrome", "focus");
  });

  /**
   * ⚠ The asymmetry is the point and is easy to "tidy" away. Below `md` the rail was never on
   * screen, so focus mode has no width to reclaim there — dropping the bar would be deleting
   * navigation in exchange for nothing. What focus mode buys is horizontal room, and horizontal
   * room is a desktop problem.
   */
  it("keeps the bottom bar in focus mode, because the phone never had a rail to reclaim", () => {
    pathname.current = "/cards/new";
    const { container } = renderWithProviders(
      <SessionProvider user={fixtureUser}>
        <AppShell>screen</AppShell>
      </SessionProvider>,
    );
    expect(container.querySelector("[data-app-bottom-bar]")).not.toBeNull();
  });
});

describe("PageHeader (spec §8D.3)", () => {
  it("renders the title as the page heading at --text-h3", () => {
    renderWithProviders(<PageHeader title="Cards" />);

    const heading = screen.getByRole("heading", { level: 1, name: "Cards" });
    expect(heading.className).toMatch(/text-h3/);
  });

  it("renders an optional muted subtitle and right-aligned actions", () => {
    const { container } = renderWithProviders(
      <PageHeader title="Cards" subtitle="Four cards" actions={<button>New card</button>} />,
    );

    const subtitle = screen.getByText("Four cards");
    expect(subtitle.className).toMatch(/text-sm/);
    expect(subtitle.className).toMatch(/text-ink-3/);

    const actions = container.querySelector("[data-page-header-actions]");
    expect(within(actions as HTMLElement).getByRole("button", { name: "New card" })).toBeInTheDocument();
    expect(actions?.className).toMatch(/\bms-auto\b|\bml-auto\b/);
  });

  it("omits the subtitle node entirely when there is none, and rules beneath", () => {
    const { container } = renderWithProviders(<PageHeader title="Cards" />);

    expect(container.querySelector("[data-page-header-subtitle]")).toBeNull();
    expect(container.querySelector("[data-page-header]")?.className).toMatch(
      /border-b border-line/,
    );
  });
});

describe("SplitView (spec §8D.4 — the layout T23's builder consumes)", () => {
  it("puts the pinned pane first in DOM order so mobile pins it to the top", () => {
    const { container } = renderWithProviders(
      <SplitView pinned={<p>preview</p>} pinnedLabel="Live preview" contentLabel="Controls">
        <p>controls</p>
      </SplitView>,
    );

    const panes = container.querySelectorAll("[data-split-pinned], [data-split-content]");
    expect(panes[0]).toHaveAttribute("data-split-pinned");
    expect(panes[1]).toHaveAttribute("data-split-content");
    expect(panes[0]).toHaveTextContent("preview");
    expect(panes[1]).toHaveTextContent("controls");
  });

  it("keeps the pinned pane sticky at every width and capped at ~45svh on mobile", () => {
    const { container } = renderWithProviders(
      <SplitView pinned={<p>preview</p>}>
        <p>controls</p>
      </SplitView>,
    );

    const pinned = container.querySelector("[data-split-pinned]");
    expect(pinned?.className).toMatch(/\bsticky\b/);
    expect(pinned?.className).toMatch(/max-h-\[45svh\]/);
    expect(pinned?.className).toMatch(/lg:max-h-/);
  });

  it("stacks below 1024px and splits ~46/54 above it", () => {
    const { container } = renderWithProviders(
      <SplitView pinned={<p>preview</p>}>
        <p>controls</p>
      </SplitView>,
    );

    const root = container.querySelector("[data-split-view]");
    expect(root?.className).toMatch(/\bgrid\b/);
    expect(root?.className).toMatch(/lg:grid-cols-\[46fr_54fr\]/);
  });

  it("moves the pinned pane to the right column without changing DOM order", () => {
    const { container } = renderWithProviders(
      <SplitView pinned={<p>preview</p>} pinnedSide="right">
        <p>controls</p>
      </SplitView>,
    );

    const root = container.querySelector("[data-split-view]");
    expect(root).toHaveAttribute("data-pinned-side", "right");
    expect(root?.className).toMatch(/lg:grid-cols-\[54fr_46fr\]/);

    const panes = container.querySelectorAll("[data-split-pinned], [data-split-content]");
    expect(panes[0]).toHaveAttribute("data-split-pinned");
    expect(panes[0]?.className).toMatch(/lg:order-2/);
    expect(panes[1]?.className).toMatch(/lg:order-1/);
  });

  it("labels both regions when asked, so a screen reader can jump between them", () => {
    renderWithProviders(
      <SplitView pinned={<p>preview</p>} pinnedLabel="Live preview" contentLabel="Controls">
        <p>controls</p>
      </SplitView>,
    );

    expect(screen.getByRole("region", { name: "Live preview" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Controls" })).toBeInTheDocument();
  });
});

/* ── the route-group layout ─────────────────────────────────────────────────────────── */

function AuthProbe() {
  const { status } = useSession();
  return <span data-testid="auth-probe">{status}</span>;
}

function ToastProbe() {
  useToast();
  return <span data-testid="toast-probe">ok</span>;
}

describe("(app) chrome — the providers and tab order every authenticated route gets", () => {
  it("mounts SessionProvider around the route", () => {
    renderWithProviders(
      <AppChrome user={fixtureUser}>
        <AuthProbe />
      </AppChrome>,
    );

    expect(screen.getByTestId("auth-probe")).toHaveTextContent("signed-in");
  });

  it("mounts ToastProvider — the cross-track contract that keeps every Select elevated", () => {
    renderWithProviders(
      <AppChrome user={fixtureUser}>
        <ToastProbe />
      </AppChrome>,
    );

    // `useToast()` throws outside the provider, so reaching this line is the proof…
    expect(screen.getByTestId("toast-probe")).toHaveTextContent("ok");
    // …and the overlay elevation stylesheet rides along with it (T08's contract).
    expect(
      document.head.querySelector(`style[data-href="${OVERLAY_STYLE_HREF}"]`),
    ).not.toBeNull();
  });

  it("renders the skip link first and the shell's single <main id=\"main\">", () => {
    const { container } = renderWithProviders(
      <AppChrome user={fixtureUser}>
        <p>page</p>
      </AppChrome>,
    );

    expect(container.querySelectorAll(FOCUSABLE)[0]).toHaveAttribute("href", "#main");
    expect(container.querySelectorAll("main#main")).toHaveLength(1);
  });
});

/* ── the route-group error boundary ─────────────────────────────────────────────────── */

function boundaryError(message = "priyanka@fernwood.example leaked into the message") {
  return Object.assign(new Error(message), { digest: "3f9a12ce" });
}

/** Only our own structured lines — React and RTL log through `console.error` too. */
function contactbookLogs(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.filter((call) => call[0] === "[contactbook]");
}

describe("(app)/error.tsx (spec §6.10, §13.1)", () => {
  it("renders the shared ErrorPanel copy, never the raw message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = boundaryError();

    const { container } = renderWithProviders(
      <AppGroupError error={error} reset={() => {}} />,
    );

    const expected = boundaryErrorPanelProps(error);
    expect(screen.getByRole("heading", { name: expected.title as string })).toBeInTheDocument();
    expect(screen.getByText(expected.detail as string)).toBeInTheDocument();
    expect(container.textContent).not.toContain(error.message);
    expect(container.textContent).not.toContain("Error:");
    spy.mockRestore();
  });

  it("surfaces the digest at [data-error-digest] and nowhere else", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = renderWithProviders(
      <AppGroupError error={boundaryError()} reset={() => {}} />,
    );

    const digest = container.querySelector("[data-error-digest]");
    expect(digest).toHaveTextContent("3f9a12ce");
    spy.mockRestore();
  });

  it("offers 'Try again' wired to retry(), falling back to reset()", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    const retry = vi.fn();
    const reset = vi.fn();
    const { unmount } = renderWithProviders(
      <AppGroupError error={boundaryError()} reset={reset} retry={retry} />,
    );
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
    unmount();

    renderWithProviders(<AppGroupError error={boundaryError()} reset={reset} />);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("links back to the dashboard, per §6.10 on an authenticated route", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithProviders(<AppGroupError error={boundaryError()} reset={() => {}} />);

    expect(screen.getByRole("link", { name: /go to dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    spy.mockRestore();
  });

  it("logs exactly the §13.1 structured shape, once, scoped to 'app'", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    pathname.current = "/cards/card_kestrel";

    renderWithProviders(<AppGroupError error={boundaryError()} reset={() => {}} />);

    const logs = contactbookLogs(spy);
    expect(logs).toHaveLength(1);
    /**
     * `toEqual` on the whole object, not `toMatchObject`, and that is the point: the assertion
     * is as much about what the payload does NOT carry as what it does.
     *
     * `message` was briefly added here under a `NODE_ENV !== "production"` gate, to cure a
     * `[contactbook] {}` line that carried nothing useful. It was reverted: §13.1 forbids PII in
     * a log, a thrown `Error` in this product routinely carries a field value, and a developer's
     * console is still a log — it gets screenshotted into tickets. `NODE_ENV` is not a
     * containment boundary either; under Vitest it is `test`, so the gate simply stood open.
     * `name` cures the empty line instead, and cannot be user data.
     */
    expect(logs[0][1]).toEqual({
      scope: "app",
      route: "/cards/card_kestrel",
      name: "Error",
      digest: "3f9a12ce",
    });
    spy.mockRestore();
  });
});

describe("the layout barrel", () => {
  it("exports every shell component the six wave-7 screen tracks import", () => {
    expect(Object.keys(barrel).sort()).toEqual(
      [
        "APP_NAV_ITEMS",
        "AppShell",
        "BottomBar",
        "NavDrawer",
        "PageHeader",
        "Sidebar",
        "SkipLink",
        "SplitView",
        "isFocusRoute",
        "isNavItemActive",
      ].sort(),
    );
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "../helpers/render";
import * as barrel from "@/components/data";
import { DataTable } from "@/components/data/data-table";
import { EmptyFilteredState } from "@/components/data/empty-filtered-state";
import { EmptyState } from "@/components/data/empty-state";
import { ErrorPanel, boundaryErrorPanelProps } from "@/components/data/error-panel";
import { FilterBar } from "@/components/data/filter-bar";
import { LoadingSkeleton } from "@/components/data/loading-skeleton";
import { NotFoundPanel } from "@/components/data/not-found-panel";
import {
  ScreenStateRoot,
  resolveDataScreenState,
} from "@/components/data/screen-state-root";
import { SearchField } from "@/components/data/search-field";
import { DATA_SCREEN_STATES } from "@/lib/screen-state";
import type { FixtureError } from "@/types/domain";

/**
 * The data-state contract suite (T10).
 *
 * Nineteen routes render these nine components for every one of their non-success
 * states, and `data-screen-state` is the single attribute T29's `states.spec.ts` and
 * `a11y.spec.ts` key off (spec §13.2, AC-24). Everything asserted here is something a
 * screen track or a sweep depends on.
 *
 * ⚠ happy-dom has no layout engine and no stylesheet: never assert geometry or computed
 * colour here (spec §14.6). What this file proves is behaviour, ARIA and class
 * contracts; the rendered proof is Playwright's, in T28 and T29.
 */

describe("ScreenStateRoot (spec §13.2, AC-24)", () => {
  it("emits every one of the six data-screen-state values", () => {
    for (const state of DATA_SCREEN_STATES) {
      const { unmount } = renderWithProviders(
        <ScreenStateRoot state={state}>content</ScreenStateRoot>,
      );
      expect(screen.getByText("content")).toHaveAttribute("data-screen-state", state);
      unmount();
    }
  });

  it("covers exactly the six values the sweeps expect — five plus empty-filtered", () => {
    expect([...DATA_SCREEN_STATES]).toEqual([
      "loading",
      "empty",
      "empty-filtered",
      "error",
      "offline",
      "success",
    ]);
  });

  it("marks only the loading state aria-busy", () => {
    for (const state of DATA_SCREEN_STATES) {
      const { unmount } = renderWithProviders(
        <ScreenStateRoot state={state}>content</ScreenStateRoot>,
      );
      const root = screen.getByText("content");

      if (state === "loading") {
        expect(root).toHaveAttribute("aria-busy", "true");
      } else {
        expect(root, state).not.toHaveAttribute("aria-busy");
      }
      unmount();
    }
  });

  it("renders the element the screen asks for, so the root can also be the landmark", () => {
    renderWithProviders(
      <ScreenStateRoot as="section" state="success" aria-label="Cards">
        content
      </ScreenStateRoot>,
    );
    expect(screen.getByRole("region", { name: "Cards" })).toHaveAttribute(
      "data-screen-state",
      "success",
    );
  });

  it("keeps the caller's own props and classes", () => {
    renderWithProviders(
      <ScreenStateRoot state="success" id="cards" className="grid gap-4">
        content
      </ScreenStateRoot>,
    );
    const root = screen.getByText("content");

    expect(root).toHaveAttribute("id", "cards");
    expect(root).toHaveClass("grid", "gap-4");
  });
});

describe("resolveDataScreenState — the gateway state to the attribute value", () => {
  it("passes loading, error and offline straight through", () => {
    for (const state of ["loading", "error", "offline"] as const) {
      expect(resolveDataScreenState({ state, isEmpty: false })).toBe(state);
      // …even when the screen also happens to have nothing to show.
      expect(resolveDataScreenState({ state, isEmpty: true, isFiltered: true })).toBe(state);
    }
  });

  it("separates the two empties by whether a filter is narrowing the collection", () => {
    expect(resolveDataScreenState({ state: "empty", isEmpty: true })).toBe("empty");
    expect(resolveDataScreenState({ state: "success", isEmpty: true, isFiltered: true })).toBe(
      "empty-filtered",
    );
    expect(resolveDataScreenState({ state: "success", isEmpty: false })).toBe("success");
  });

  it("lets the screen's own verdict beat ?state=empty (E-08)", () => {
    // `?state=empty` hands /profile seven groups with `fieldIds: []`, not zero groups.
    // A screen that still has something to render says so and gets `success`.
    expect(resolveDataScreenState({ state: "empty", isEmpty: false })).toBe("success");
  });
});

describe("LoadingSkeleton (spec §8D.1 — skeletons, never spinners)", () => {
  it("marks the region aria-busy and names what is loading", () => {
    renderWithProviders(<LoadingSkeleton variant="card-grid" label="Loading cards" />);
    const region = screen.getByRole("status");

    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveTextContent("Loading cards");
  });

  it("renders bones, and never a spinner", () => {
    const { container } = renderWithProviders(<LoadingSkeleton variant="list" count={8} />);

    expect(container.querySelectorAll("[data-skeleton]").length).toBeGreaterThan(0);
    expect(container.querySelector(".animate-spin")).toBeNull();
    expect(container.querySelector("[role='progressbar']")).toBeNull();
  });

  it("repeats the bone `count` times so the skeleton matches the real list length", () => {
    const { container } = renderWithProviders(<LoadingSkeleton variant="list" count={8} />);
    expect(container.querySelectorAll("[data-skeleton-row]")).toHaveLength(8);
  });

  it("holds the gallery tile's aspect so nothing shifts when the card arrives", () => {
    const { container } = renderWithProviders(<LoadingSkeleton variant="card" />);
    // 400x860 is the card's design box (§8D.4). A square bone would reflow the page.
    expect(container.querySelector("[data-skeleton-card]")).toHaveClass("aspect-[336/500]");
  });

  it("offers a layout-matched variant for each shape §8D.3 asks for", () => {
    const variants = [
      "card",
      "card-grid",
      "card-detail",
      "list",
      "table",
      "stats",
      "fields",
      "groups",
      "form",
    ] as const;

    for (const variant of variants) {
      const { container, unmount } = renderWithProviders(<LoadingSkeleton variant={variant} />);
      expect(
        container.querySelector(`[data-loading-skeleton='${variant}']`),
        variant,
      ).not.toBeNull();
      unmount();
    }
  });

  it("keeps the bones out of the accessibility tree — the label is the announcement", () => {
    const { container } = renderWithProviders(<LoadingSkeleton variant="stats" />);
    expect(container.querySelector("[data-skeleton-bones]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

describe("The two empty states are different components (spec §8D.1, AC-24)", () => {
  it("is literally two components, not one with a flag", () => {
    expect(EmptyState).not.toBe(EmptyFilteredState);
    expect(barrel.EmptyState).not.toBe(barrel.EmptyFilteredState);
  });

  it("marks itself so a sweep can tell the two apart without reading copy", () => {
    const { unmount } = renderWithProviders(
      <EmptyState title="You haven't made a card yet" />,
    );
    expect(screen.getByRole("heading", { level: 2 }).closest("[data-empty-state]")).toHaveAttribute(
      "data-empty-state",
      "first-run",
    );
    unmount();

    renderWithProviders(<EmptyFilteredState noun="cards" onClearFilters={() => {}} />);
    expect(screen.getByRole("heading", { level: 2 }).closest("[data-empty-state]")).toHaveAttribute(
      "data-empty-state",
      "filtered",
    );
  });

  it("gives the first-run state the one action that resolves it", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    renderWithProviders(
      <EmptyState
        title="You haven't made a card yet"
        description="A card is a filter over your profile."
        action={{ label: "Create your first card", onClick }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create your first card" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the first-run action as a real link when given an href", () => {
    renderWithProviders(
      <EmptyState
        title="You haven't made a card yet"
        action={{ label: "Create your first card", href: "/cards/new" }}
      />,
    );

    expect(screen.getByRole("link", { name: "Create your first card" })).toHaveAttribute(
      "href",
      "/cards/new",
    );
  });

  it("gives the filtered state Clear filters — and never a create CTA", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();

    renderWithProviders(<EmptyFilteredState noun="cards" onClearFilters={onClearFilters} />);

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);

    // The banned conflation: a user who filtered to nothing must never be told to
    // create their first card (§8D.1).
    expect(screen.queryByRole("button", { name: /create/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /create/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/first card/i);
  });

  it("echoes the query back so the filtered copy is about what the user did", () => {
    renderWithProviders(
      <EmptyFilteredState noun="contacts" query="zzz" onClearFilters={() => {}} />,
    );
    expect(document.body.textContent).toContain("zzz");
  });

  it("earns its place with type, not with an illustration or an emoji (§8C)", () => {
    const { container } = renderWithProviders(
      <EmptyState
        title="No saved contacts yet"
        description="Contacts arrive when someone scans your card and saves it."
        action={{ label: "Share a card", href: "/cards" }}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent ?? "").not.toMatch(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
    );
  });

  it("lets a screen place the heading at the right level for its outline", () => {
    renderWithProviders(<EmptyState title="No fields in Work yet" headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("No fields in Work yet");
  });
});

describe("ErrorPanel (spec §6.10)", () => {
  const networkError: FixtureError = {
    kind: "network",
    title: "You're offline",
    detail: "Check your connection and try again.",
    retryable: true,
  };

  it("renders the §6.10 anatomy in order — overline, title, detail, actions", () => {
    renderWithProviders(<ErrorPanel error={networkError} onRetry={() => {}} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("You're offline");
    expect(screen.getByText("Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("renders Try again ONLY when the error is retryable", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    const { unmount } = renderWithProviders(
      <ErrorPanel error={networkError} onRetry={onRetry} />,
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    unmount();

    renderWithProviders(
      <ErrorPanel
        error={{ ...networkError, retryable: false }}
        onRetry={onRetry}
      />,
    );
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("takes the public-route copy without a second component", () => {
    renderWithProviders(
      <ErrorPanel error={networkError} homeHref="/" homeLabel="Go home" />,
    );
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
  });

  it("shows the digest only when there is one, muted and selectable", () => {
    const { unmount } = renderWithProviders(<ErrorPanel error={networkError} />);
    expect(document.querySelector("[data-error-digest]")).toBeNull();
    unmount();

    renderWithProviders(<ErrorPanel error={networkError} digest="a1b2c3" />);
    const digest = document.querySelector("[data-error-digest]");

    expect(digest).toHaveTextContent("a1b2c3");
    expect(digest).toHaveClass("text-xs", "text-ink-3", "select-all");
  });

  it("never shows a stack trace, a raw message, or an error code as the headline", () => {
    const thrown = Object.assign(new Error("TypeError: undefined is not a function"), {
      digest: "9f9f9f",
      stack: "Error: boom\n    at Object.<anonymous> (/app/page.tsx:1:1)",
    });

    renderWithProviders(<ErrorPanel {...boundaryErrorPanelProps(thrown)} onRetry={() => {}} />);
    const text = document.body.textContent ?? "";

    expect(text).not.toContain("TypeError");
    expect(text).not.toContain("at Object.<anonymous>");
    expect(screen.getByRole("heading", { level: 2 }).textContent).not.toMatch(
      /error|9f9f9f|unknown/i,
    );
    // The digest is still surfaced — muted, at the bottom, as a caption.
    expect(document.querySelector("[data-error-digest]")).toHaveTextContent("9f9f9f");
  });

  it("is usable inline, because a partial failure must not blank the page (§8D.1)", () => {
    renderWithProviders(
      <ErrorPanel
        variant="inline"
        title="We couldn't load your contacts"
        detail="Your cards are fine. Try again for the rest."
        retryable
        onRetry={() => {}}
      />,
    );

    const banner = screen.getByRole("alert");
    expect(banner).toHaveAttribute("data-error-panel", "inline");
    expect(within(banner).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    // An inline banner sits beside content that DID load — it must not offer to
    // navigate the reader away from it.
    expect(within(banner).queryByRole("link")).toBeNull();
  });

  it("boundaryErrorPanelProps keeps the digest and drops everything else", () => {
    const props = boundaryErrorPanelProps(
      Object.assign(new Error("secret@example.com not found"), { digest: "abc" }),
    );

    expect(props.digest).toBe("abc");
    expect(props.retryable).toBe(true);
    expect(JSON.stringify(props)).not.toContain("secret@example.com");
  });
});

describe("NotFoundPanel (spec §8D.3, §8D.5 — a panel, never a raw 404)", () => {
  it("is a different component from ErrorPanel and offers no retry", () => {
    expect(NotFoundPanel).not.toBe(ErrorPanel);

    renderWithProviders(
      <NotFoundPanel
        title="This card doesn't exist or was removed"
        backHref="/"
        backLabel="Go home"
      />,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "This card doesn't exist or was removed",
    );
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
    expect(document.querySelector("[data-not-found-panel]")).not.toBeNull();
  });

  it("never puts a bare status code where the title goes", () => {
    renderWithProviders(<NotFoundPanel />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).not.toMatch(/^\s*404\s*$/);
    expect(document.body.textContent).not.toContain("404");
  });
});

describe("FilterBar (spec §8D.3)", () => {
  const filters = [
    { id: "personal", label: "Personal", count: 3 },
    { id: "work", label: "Work", count: 5 },
  ] as const;

  it("groups the filters under one accessible name and exposes pressed state", () => {
    renderWithProviders(
      <FilterBar
        label="Filter cards"
        filters={filters}
        selectedIds={["work"]}
        onToggle={() => {}}
        onClear={() => {}}
      />,
    );

    const group = screen.getByRole("group", { name: "Filter cards" });
    expect(within(group).getByRole("button", { name: /Work/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(group).getByRole("button", { name: /Personal/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reports the active count so a screen can pick its empty state", () => {
    renderWithProviders(
      <FilterBar
        label="Filter cards"
        filters={filters}
        selectedIds={["work", "personal"]}
        onToggle={() => {}}
        onClear={() => {}}
      />,
    );
    expect(document.querySelector("[data-filter-bar]")).toHaveAttribute(
      "data-active-filter-count",
      "2",
    );
  });

  it("shows Clear filters only while something is filtering", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();

    const { unmount } = renderWithProviders(
      <FilterBar
        label="Filter cards"
        filters={filters}
        selectedIds={[]}
        onToggle={() => {}}
        onClear={onClear}
      />,
    );
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
    unmount();

    renderWithProviders(
      <FilterBar
        label="Filter cards"
        filters={filters}
        selectedIds={["work"]}
        onToggle={() => {}}
        onClear={onClear}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("toggles by id", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderWithProviders(
      <FilterBar
        label="Filter cards"
        filters={filters}
        selectedIds={[]}
        onToggle={onToggle}
        onClear={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Personal/ }));
    expect(onToggle).toHaveBeenCalledWith("personal");
  });
});

describe("SearchField (spec §8D.3)", () => {
  it("keeps a programmatic label even when the design hides it", () => {
    renderWithProviders(
      <SearchField label="Search contacts" value="" onValueChange={() => {}} />,
    );
    const input = screen.getByRole("searchbox", { name: "Search contacts" });

    expect(input).toHaveAttribute("type", "search");
  });

  it("reports keystrokes to the screen that owns the query", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    renderWithProviders(
      <SearchField label="Search contacts" value="" onValueChange={onValueChange} />,
    );
    await user.type(screen.getByRole("searchbox"), "a");

    expect(onValueChange).toHaveBeenCalledWith("a");
  });

  it("offers a named clear control only once there is something to clear", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    const { unmount } = renderWithProviders(
      <SearchField label="Search contacts" value="" onValueChange={onValueChange} />,
    );
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    unmount();

    renderWithProviders(
      <SearchField label="Search contacts" value="mei" onValueChange={onValueChange} />,
    );
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  it("announces the result count politely, so filtering is not silent", () => {
    renderWithProviders(
      <SearchField
        label="Search contacts"
        value="mei"
        onValueChange={() => {}}
        resultsLabel="2 contacts"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("2 contacts");
  });
});

describe("DataTable (spec §8D.3 — table at >=768px, list below)", () => {
  interface Row {
    id: string;
    name: string;
    source: string;
    saved: string;
  }

  const rows: Row[] = [
    { id: "c1", name: "Mei Lin", source: "Work card", saved: "12 Aug 2026" },
    { id: "c2", name: "Arjun Rao", source: "Personal card", saved: "3 Aug 2026" },
  ];

  const columns = [
    { id: "name", header: "Name", cell: (row: Row) => row.name, primary: true },
    { id: "source", header: "Source card", cell: (row: Row) => row.source },
    { id: "saved", header: "Saved", cell: (row: Row) => row.saved },
  ] as const;

  function renderTable() {
    return renderWithProviders(
      <DataTable
        caption="Saved contacts"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
      />,
    );
  }

  it("renders real table semantics with a caption and column headers", () => {
    renderTable();
    const table = screen.getByRole("table", { name: "Saved contacts" });

    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    expect(within(table).getAllByRole("row")).toHaveLength(3); // header + 2
    expect(within(table).getByText("Mei Lin")).toBeInTheDocument();
  });

  it("puts scope=col on every header, so a row reads correctly cell by cell", () => {
    renderTable();
    for (const header of screen.getAllByRole("columnheader")) {
      expect(header).toHaveAttribute("scope", "col");
    }
  });

  it("ships a parallel stacked list for <=767px and hides exactly one of the two", () => {
    const { container } = renderTable();
    const table = container.querySelector("[data-table-view='table']");
    const list = container.querySelector("[data-table-view='list']");

    // Two views, one DOM: `display: none` takes the hidden one out of the
    // accessibility tree, so no screen reader ever meets the content twice.
    expect(table).toHaveClass("hidden", "md:table");
    expect(list).toHaveClass("md:hidden");
    expect(list?.tagName).toBe("UL");
    expect(list?.querySelectorAll("li")).toHaveLength(2);
  });

  it("names the list view after the caption, since a <ul> has no <caption>", () => {
    const { container } = renderTable();
    expect(container.querySelector("[data-table-view='list']")).toHaveAttribute(
      "aria-label",
      "Saved contacts",
    );
  });

  it("labels every stacked value with its column header", () => {
    const { container } = renderTable();
    const list = container.querySelector("[data-table-view='list']");

    expect(within(list as HTMLElement).getAllByText("Source card")).not.toHaveLength(0);
    expect(within(list as HTMLElement).getAllByText("Saved")).not.toHaveLength(0);
  });

  it("links the primary cell when the screen supplies a row href", () => {
    const { container } = renderWithProviders(
      <DataTable
        caption="Saved contacts"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `/contacts/${row.id}`}
      />,
    );

    const links = container.querySelectorAll("a[href='/contacts/c1']");
    // One in the table view, one in the list view.
    expect(links).toHaveLength(2);
  });

  it("renders an empty body rather than inventing its own empty state", () => {
    renderWithProviders(
      <DataTable
        caption="Saved contacts"
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
      />,
    );

    // Emptiness is EmptyState's / EmptyFilteredState's job — the two are different
    // components and the table cannot know which one applies.
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });
});

describe("The barrel (@/components/data)", () => {
  it("exports all nine components", () => {
    for (const name of [
      "EmptyState",
      "EmptyFilteredState",
      "ErrorPanel",
      "NotFoundPanel",
      "LoadingSkeleton",
      "FilterBar",
      "SearchField",
      "DataTable",
      "ScreenStateRoot",
    ]) {
      expect(barrel, `missing export: ${name}`).toHaveProperty(name);
    }
  });

  it("exports the helpers the screen tracks need beside them", () => {
    expect(barrel).toHaveProperty("resolveDataScreenState");
    expect(barrel).toHaveProperty("boundaryErrorPanelProps");
  });
});

describe("Anti-AI lint lock for src/components/data (F-01, F-04, F-05, F-09, F-10, F-11)", () => {
  // Vitest's root is `apps/web`, so cwd-relative is stable under `pnpm --filter web`.
  const dir = resolve(process.cwd(), "src/components/data");
  const sources = readdirSync(dir)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .map((name) => [name, readFileSync(join(dir, name), "utf8")] as const);

  it("reads the nine components plus the barrel", () => {
    expect(sources.length).toBe(10);
  });

  it.each([
    ["colour literal (F-01)", "#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(|oklch\\("],
    ["gradient (F-04)", "gradient"],
    ["glassmorphism (F-05)", "backdrop-(blur|filter)"],
    ["elevation (F-09)", "shadow-|box-shadow"],
    ["oversized radius (F-10)", "rounded-(2xl|3xl)"],
    ["type weight above 500 (F-11)", "font-(bold|semibold|extrabold|black)"],
  ])("contains no %s", (_label, pattern) => {
    const regex = new RegExp(pattern);
    for (const [name, source] of sources) {
      expect(regex.test(source), `${name} matched /${pattern}/`).toBe(false);
    }
  });

  it("contains no default Tailwind palette utility — tokens only", () => {
    const palette = new RegExp(
      "\\b(?:bg|text|border|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|" +
        "yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-",
    );
    for (const [name, source] of sources) {
      expect(palette.test(source), `${name} used a default palette utility`).toBe(false);
    }
  });

  it("reaches no network and no browser storage (§3.1, AC-06)", () => {
    const banned = new RegExp(
      "fetch\\(|axios|useSWR|useQuery|localStorage|sessionStorage|document\\.cookie",
    );
    for (const [name, source] of sources) {
      expect(banned.test(source), `${name} crossed the UI-only wall`).toBe(false);
    }
  });
});

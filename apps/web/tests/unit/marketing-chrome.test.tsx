import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "../helpers/render";
import RootError from "@/app/error";
import RootNotFound from "@/app/not-found";
import MarketingError from "@/app/(marketing)/error";
import MarketingLayout from "@/app/(marketing)/layout";
import { boundaryScopeForPath } from "@/components/data/error-panel";
import { PillNav } from "@/components/marketing/pill-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { OVERLAY_CSS, OVERLAY_STYLE_HREF } from "@/components/overlay";

/**
 * The public shells (T14) — the chrome every public surface mounts inside, and the two
 * last-resort boundaries for the whole product.
 *
 * `not-found.tsx` and `error.tsx` at the app root are what a stranger who scanned a QR
 * code sees when something is wrong. They run with no session, no fixture read and no
 * assumptions, which is why both are asserted here against a bare render rather than
 * through a screen.
 *
 * Three cross-track contracts are pinned by this file, because nothing else can:
 *   1. `(marketing)/layout.tsx` mounts `<OverlayStyles />` — T08's elevation rule is
 *      normally carried by an overlay component, and there is none in this group.
 *   2. Both boundaries go through `boundaryErrorPanelProps()`, so a thrown message can
 *      never reach the DOM (§13.1).
 *   3. The nav and the footer belong to neither `/` (T26) nor `/templates` (T19), so
 *      cutting the marketing page per §3.5 cannot take the gallery's chrome with it.
 *
 * ⚠ happy-dom has no layout engine and no compiled Tailwind sheet: never assert geometry
 * or computed colour here (spec §14.6). This file proves markup, ARIA, attribute and
 * source contracts; the rendered proof belongs to T28/T29 in Playwright.
 */

const SRC = resolve(__dirname, "../../src");

const OWNED_SOURCES = [
  "components/marketing/pill-nav.tsx",
  "components/marketing/site-footer.tsx",
  "app/not-found.tsx",
  "app/error.tsx",
  "app/(marketing)/layout.tsx",
  "app/(marketing)/error.tsx",
] as const;

function source(relative: string): string {
  return readFileSync(resolve(SRC, relative), "utf8");
}

/** A boundary argument shaped exactly like the one Next hands `error.tsx`. */
function thrownError(digest?: string): Error & { digest?: string } {
  // The message deliberately carries something that looks like PII, so "the panel never
  // renders `error.message`" is asserted against a string that would be obvious if it leaked.
  const error = new Error("could not load priyanka@example.com's card") as Error & {
    digest?: string;
  };
  if (digest) error.digest = digest;
  return error;
}

function hoistedOverlaySheet(): HTMLStyleElement | null {
  // React 19 hoists `<style href precedence>` into <head> and rewrites `href` to
  // `data-href` (the mechanism T08 documents in `overlay/index.ts`).
  return document.head.querySelector<HTMLStyleElement>(
    `style[data-href="${OVERLAY_STYLE_HREF}"]`,
  );
}

describe("PillNav — the floating pill bar (spec §8D.6, §8.7)", () => {
  it("renders one wordmark, three centre links and two CTAs — six links, no more", () => {
    renderWithProviders(<PillNav />);

    const nav = screen.getByRole("navigation", { name: /primary/i });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(6);

    expect(within(nav).getByRole("link", { name: "Contact Book" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(nav).getByRole("link", { name: "Templates" })).toHaveAttribute(
      "href",
      "/templates",
    );
    expect(within(nav).getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/#how-it-works",
    );
    // Pricing is gone from the page — every figure on it was invented — so the nav's third
    // section link is the questions instead. A visitor with a doubt is the visitor this page
    // is written for, so the FAQ earns the slot.
    expect(within(nav).getByRole("link", { name: "Questions" })).toHaveAttribute(
      "href",
      "/#faq",
    );
    expect(within(nav).getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/signin/phone",
    );
    expect(within(nav).getByRole("link", { name: "Get started" })).toHaveAttribute(
      "href",
      "/signup/first-name",
    );
  });

  it("gives every link an accessible name (AC-25)", () => {
    renderWithProviders(<PillNav />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.textContent?.trim()).not.toBe("");
    }
  });

  it("claims elevation through the §13.2 attribute, never a declaration of its own", () => {
    renderWithProviders(<PillNav />);

    const bar = document.querySelector("[data-pill-nav]");
    expect(bar).not.toBeNull();
    // §8.7: elevation is permitted here ONLY because the bar is fixed. The value comes
    // from T08's attribute rule; F-09 forbids this directory declaring one itself.
    expect(bar).toHaveAttribute("data-elevation", "1");
    expect(bar?.className).toMatch(/\bfixed\b/);
  });

  it("renders no icon at all — §8.8 bans them above the footer", () => {
    const { container } = renderWithProviders(<PillNav />);
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });

  it("routes every destination into the §6.1 manifest", () => {
    renderWithProviders(<PillNav />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(
        /^(\/|\/templates|\/signin\/phone|\/signup\/first-name|\/#[a-z-]+)$/,
      );
    }
  });
});

describe("SiteFooter — the multi-column footer (spec §8D.6 M-9)", () => {
  it("is the contentinfo landmark and carries the wordmark", () => {
    renderWithProviders(<SiteFooter />);

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Contact Book" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("renders multiple labelled columns rather than one undifferentiated link list", () => {
    renderWithProviders(<SiteFooter />);

    const footer = screen.getByRole("contentinfo");
    const columns = within(footer).getAllByRole("navigation");
    expect(columns.length).toBeGreaterThanOrEqual(2);

    for (const column of columns) {
      // Every column names itself, so a screen reader can tell them apart (AC-25).
      const name =
        column.getAttribute("aria-label") ??
        document.getElementById(column.getAttribute("aria-labelledby") ?? "")?.textContent;
      expect(name?.trim()).toBeTruthy();
      expect(within(column).getAllByRole("link").length).toBeGreaterThan(0);
    }
  });

  it("keeps the gallery reachable from the footer at every width", () => {
    renderWithProviders(<SiteFooter />);

    expect(
      within(screen.getByRole("contentinfo")).getByRole("link", { name: "Templates" }),
    ).toHaveAttribute("href", "/templates");
  });

  it("renders no icons and no emoji (F-07, and the plan's own footer rule)", () => {
    const { container } = renderWithProviders(<SiteFooter />);

    expect(container.querySelectorAll("svg")).toHaveLength(0);
    expect(container.textContent ?? "").not.toMatch(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/u,
    );
  });

  it("names every link and points each one at a real route", () => {
    renderWithProviders(<SiteFooter />);

    for (const link of within(screen.getByRole("contentinfo")).getAllByRole("link")) {
      expect(link.textContent?.trim()).not.toBe("");
      expect(link.getAttribute("href")).toMatch(
        /^(\/|\/templates|\/signin\/phone|\/signup\/first-name|\/#[a-z-]+)$/,
      );
    }
  });
});

describe("root not-found.tsx — the last-resort 404 (R-19, spec §6.10)", () => {
  it("renders the not-found panel with an h1 and a way home", () => {
    renderWithProviders(<RootNotFound />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent?.trim()).not.toBe("");
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
  });

  it("never shows a raw status code, a stack trace or a retry", () => {
    const { container } = renderWithProviders(<RootNotFound />);

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\b404\b/);
    expect(text).not.toMatch(/\bat\s+\w+\s+\(/); // a stack frame
    // Retrying a wrong URL just fails again — the panel deliberately offers no "Try again".
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("assumes no session — it links home, never to /dashboard", () => {
    renderWithProviders(<RootNotFound />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toMatch(/^\/dashboard/);
    }
  });
});

describe("root error.tsx — the last-resort boundary (spec §6.10, §13.1)", () => {
  it("renders the §6.10 anatomy: overline, title, detail, retry, home", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();

    renderWithProviders(<RootError error={thrownError()} retry={retry} />);

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 }).textContent?.trim()).not.toBe("");
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });

  it("falls back to reset() when Next hands it only the older prop", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();

    renderWithProviders(<RootError error={thrownError()} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it("surfaces the digest as the ONLY trace of the error, and never the message", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = renderWithProviders(
      <RootError error={thrownError("9f2c41ab")} retry={() => {}} />,
    );

    const digest = container.querySelector("[data-error-digest]");
    expect(digest).toHaveTextContent("9f2c41ab");
    expect(container.textContent ?? "").not.toContain("priyanka@example.com");

    consoleError.mockRestore();
  });

  it("omits the digest caption entirely when there is none", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = renderWithProviders(
      <RootError error={thrownError()} retry={() => {}} />,
    );

    expect(container.querySelector("[data-error-digest]")).toBeNull();
    consoleError.mockRestore();
  });

  it("logs the §13.1 structured shape with no PII in it", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithProviders(<RootError error={thrownError("9f2c41ab")} retry={() => {}} />);

    expect(consoleError).toHaveBeenCalledTimes(1);
    const [prefix, payload] = consoleError.mock.calls[0] as [string, Record<string, unknown>];
    expect(prefix).toBe("[contactbook]");
    expect(payload.scope).toBe("marketing");
    expect(payload.route).toBe("/");
    expect(payload.digest).toBe("9f2c41ab");
    expect(JSON.stringify(payload)).not.toContain("priyanka@example.com");

    consoleError.mockRestore();
  });

  /**
   * The path→scope mapping, tested as the pure function it is.
   *
   * It was first written as a rendered-component test that called
   * `window.history.replaceState({}, "", "/c/prya-hq")` and then asserted the logged scope.
   * happy-dom does not update `window.location.pathname` in response to `replaceState`, so the
   * boundary read the default `/`, took the `marketing` branch, and the test measured the exact
   * opposite of what it claimed while reading as though it passed. Rather than fight the DOM to
   * reach two lines of logic, the logic is exported and tabled here — and the integration test
   * above still proves the wiring, by asserting the `marketing` case end to end through a real
   * render.
   */
  it.each([
    ["/c/prya-hq", "public-card"],
    ["/c/", "public-card"],
    ["/", "marketing"],
    ["/templates", "marketing"],
    ["/cards", "marketing"],
    // A path that merely *contains* `/c/` is not a public card route.
    ["/cards/c/x", "marketing"],
  ])("classifies %s as %s (the plan's 'as appropriate')", (path, scope) => {
    expect(boundaryScopeForPath(path)).toBe(scope);
  });
});

describe("(marketing)/error.tsx — the group boundary (spec §13.1)", () => {
  it("renders the same panel and sends the reader home, not to the dashboard", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();

    const { container } = renderWithProviders(
      <MarketingError error={thrownError("77ab01")} retry={retry} />,
    );

    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
    expect(container.querySelector("[data-error-digest]")).toHaveTextContent("77ab01");
    expect(container.textContent ?? "").not.toContain("priyanka@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });

  it("scopes its log line to the marketing group", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithProviders(<MarketingError error={thrownError()} retry={() => {}} />);

    const [prefix, payload] = consoleError.mock.calls[0] as [string, Record<string, unknown>];
    expect(prefix).toBe("[contactbook]");
    expect(payload.scope).toBe("marketing");

    consoleError.mockRestore();
  });

  it("renders one h1 only — it replaces the page, it does not sit beside one", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithProviders(<MarketingError error={thrownError()} retry={() => {}} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    consoleError.mockRestore();
  });
});

describe("(marketing)/layout.tsx — the shared chrome (spec §8D.6)", () => {
  function renderLayout() {
    return renderWithProviders(
      <MarketingLayout params={Promise.resolve({})}>
        <p>page content</p>
      </MarketingLayout>,
    );
  }

  it("mounts the nav, a main landmark and the footer around the page", () => {
    renderLayout();

    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(within(main).getByText("page content")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("MOUNTS <OverlayStyles /> — the one manual step in T08's elevation contract", () => {
    renderLayout();

    const sheet = hoistedOverlaySheet();
    expect(sheet).not.toBeNull();
    expect(sheet?.textContent).toBe(OVERLAY_CSS);
    // Without it the pill bar's `data-elevation="1"` resolves to nothing and every
    // `<Select>` T19 renders on `/templates` floats flat against the page.
    expect(source("app/(marketing)/layout.tsx")).toContain("OverlayStyles");
  });

  it("gives <main> a stable id so a page can target it", () => {
    renderLayout();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("owns the clearance under the fixed bar so pages keep their own rhythm", () => {
    renderLayout();
    // The bar is fixed and therefore out of flow; if the layout did not pad `<main>`,
    // T19's first row and T26's hero would start underneath it.
    expect(screen.getByRole("main").className).toMatch(/\bpt-\d+\b/);
  });

  it("stays independent of the page it wraps (§3.5 cut order)", () => {
    // The chrome must not import `/`'s sections: cutting T26 may not break T19.
    const layout = source("app/(marketing)/layout.tsx");
    expect(layout).not.toMatch(/from "@\/components\/marketing\/(?!pill-nav|site-footer)/);
    expect(layout).not.toContain("./page");
  });
});

describe("the chrome's own lint lock (spec §8C, AC-15, AC-32, §3.1)", () => {
  it.each(OWNED_SOURCES)("%s carries no colour literal (F-01)", (file) => {
    expect(source(file)).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/);
  });

  it.each(OWNED_SOURCES)("%s declares no elevation of its own (F-09)", (file) => {
    // The pill bar is elevated by T08's attribute rule. A declaration here — in a class
    // or in a comment — makes the plan's `grep -rn` verification print.
    expect(source(file)).not.toMatch(/box-shadow|shadow-(sm|md|lg|xl|2xl|none|\[)/);
  });

  it.each(OWNED_SOURCES)("%s avoids the generated-UI tells (F-04, F-05, F-10, F-11)", (file) => {
    const text = source(file);
    expect(text).not.toMatch(/gradient/i);
    expect(text).not.toMatch(/backdrop-(filter|blur)/);
    expect(text).not.toMatch(/rounded-(2xl|3xl)/);
    expect(text).not.toMatch(/font-(bold|semibold|extrabold|black)/);
  });

  it.each(OWNED_SOURCES)("%s stays behind the §3.1 UI-only wall", (file) => {
    const text = source(file);
    expect(text).not.toMatch(/\bfetch\(|\baxios\b|useSWR|useQuery/);
    expect(text).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });

  it.each(OWNED_SOURCES)("%s never injects HTML (AC-32)", (file) => {
    expect(source(file)).not.toContain("dangerouslySetInnerHTML");
  });

  it.each(OWNED_SOURCES)("%s pairs every _blank with rel=noopener noreferrer (AC-32)", (file) => {
    const text = source(file);
    const blanks = text.match(/target="_blank"/g) ?? [];
    const rels = text.match(/rel="noopener noreferrer"/g) ?? [];
    expect(rels.length).toBeGreaterThanOrEqual(blanks.length);
  });

  it.each(["app/error.tsx", "app/(marketing)/error.tsx"] as const)(
    "%s goes through boundaryErrorPanelProps and never touches error.message",
    (file) => {
      const text = source(file);
      expect(text).toContain("boundaryErrorPanelProps");
      // §13.1 shows `message` in the log shape and then forbids PII in the same sentence.
      // The rule wins over the sample: a thrown message here may carry a field value.
      expect(text).not.toMatch(/error\.message/);
    },
  );

  it("keeps the chrome's copy out of the F-13 phrase book", () => {
    const banned =
      /effortlessly|seamlessly|supercharge|unlock the|elevate your|game-changing|say goodbye to|revolutionize|in seconds|transform your/i;

    for (const file of OWNED_SOURCES) {
      expect(source(file), file).not.toMatch(banned);
    }
  });

  it("keeps emoji out of the chrome (F-07, F-08)", () => {
    for (const file of OWNED_SOURCES) {
      expect(source(file), file).not.toMatch(
        /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
      );
    }
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHook, renderWithProviders, screen } from "../helpers/render";
import { EMPTY_FIXTURE_DB, FIXTURE_DB } from "@/fixtures";
import type { FixtureDb } from "@/fixtures";
import { SessionProvider, useOptionalSession, useSession } from "@/lib/session-context";
import { useFixture } from "@/lib/fixture-gateway";
import { isScreenState, parseScreenState, SCREEN_STATES } from "@/lib/screen-state";

/**
 * The `?state=` switch of spec §6.3 — the mechanism that makes loading, empty, error and
 * offline *reachable* in an application with no network, and therefore testable at all.
 *
 * §11 E-34 is the row that matters most here: an unrecognised value must fall back to
 * `success` and must never throw. `?state=` ships in production builds (it is Vansh's
 * review tool, not a dev affordance), so a throw would be a live white screen.
 */

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
}));

function visit(search: string): void {
  nav.search = search;
}

beforeEach(() => {
  visit("");
});

describe("parseScreenState (spec §6.3)", () => {
  it("declares exactly the five states the switch can reach", () => {
    expect([...SCREEN_STATES]).toEqual(["success", "loading", "empty", "error", "offline"]);
  });

  it.each([...SCREEN_STATES])("round-trips %s", (state) => {
    expect(parseScreenState(state)).toBe(state);
    expect(isScreenState(state)).toBe(true);
  });

  it("falls back to success for an unrecognised value (E-34) and never throws", () => {
    expect(() => parseScreenState("banana")).not.toThrow();
    expect(parseScreenState("banana")).toBe("success");
    expect(parseScreenState("")).toBe("success");
    expect(parseScreenState(null)).toBe("success");
    expect(parseScreenState(undefined)).toBe("success");
  });

  it("tolerates case and surrounding whitespace — a hand-typed URL still works", () => {
    expect(parseScreenState(" Loading ")).toBe("loading");
    expect(parseScreenState("OFFLINE")).toBe("offline");
  });

  it("rejects a non-member for the type guard", () => {
    expect(isScreenState("banana")).toBe(false);
    expect(isScreenState("empty-filtered")).toBe(false);
  });
});

describe("useFixture — the success path", () => {
  it("returns the selected fixture data synchronously, with no error", () => {
    const { result } = renderHook(() => useFixture((db) => db.cards));

    expect(result.current.state).toBe("success");
    expect(result.current.data).toBe(FIXTURE_DB.cards);
    expect(result.current.error).toBeNull();
  });

  it("hands the selector the whole db", () => {
    const select = vi.fn((db: FixtureDb) => db.contacts);
    renderHook(() => useFixture(select));

    expect(select).toHaveBeenCalledWith(FIXTURE_DB);
  });

  it("is the default when no ?state= is present at all", () => {
    visit("?page=2");
    const { result } = renderHook(() => useFixture((db) => db.cards));
    expect(result.current.state).toBe("success");
  });

  it("returns synchronously — no promise, no timer, no second render to wait for", () => {
    const { result } = renderHook(() => useFixture((db) => db.user));
    expect(result.current.data).toBe(FIXTURE_DB.user);
  });
});

describe("useFixture — ?state=loading", () => {
  it("returns null data and no error, and never resolves (E-35)", () => {
    visit("?state=loading");
    const { result } = renderHook(() => useFixture((db) => db.cards));

    expect(result.current.state).toBe("loading");
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("does not run the selector — there is nothing to select yet", () => {
    visit("?state=loading");
    const select = vi.fn((db: FixtureDb) => db.cards);
    renderHook(() => useFixture(select));

    expect(select).not.toHaveBeenCalled();
  });
});

describe("useFixture — ?state=empty", () => {
  it("returns the empty collection, not null: empty is data, not absence", () => {
    visit("?state=empty");
    const { result } = renderHook(() => useFixture((db) => db.cards));

    expect(result.current.state).toBe("empty");
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("keeps the user, so the shell still renders (§6.3)", () => {
    visit("?state=empty");
    const { result } = renderHook(() => useFixture((db) => db.user));
    expect(result.current.data).toBe(EMPTY_FIXTURE_DB.user);
  });

  it("keeps the seven groups with no fields — E-08, not a missing profile", () => {
    visit("?state=empty");
    const { result } = renderHook(() => useFixture((db) => db.groups));
    expect(result.current.data).toHaveLength(7);
    expect(result.current.data?.every((group) => group.fieldIds.length === 0)).toBe(true);
  });
});

describe("useFixture — ?state=error", () => {
  it("returns a retryable unknown error and no data", () => {
    visit("?state=error");
    const { result } = renderHook(() => useFixture((db) => db.cards));

    expect(result.current.state).toBe("error");
    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({
      kind: "unknown",
      title: expect.any(String),
      detail: expect.any(String),
      retryable: true,
    });
  });

  it("writes human copy: no error codes, no jargon, a sentence the user can act on (§6.10)", () => {
    visit("?state=error");
    const { result } = renderHook(() => useFixture((db) => db.cards));
    const error = result.current.error;

    expect(error?.title.length).toBeGreaterThan(0);
    expect(error?.title).not.toMatch(/\d{3}/);
    expect(error?.detail).toMatch(/\.$/);
  });
});

describe("useFixture — ?state=offline", () => {
  it("returns a retryable network error and no data", () => {
    visit("?state=offline");
    const { result } = renderHook(() => useFixture((db) => db.cards));

    expect(result.current.state).toBe("offline");
    expect(result.current.data).toBeNull();
    expect(result.current.error?.kind).toBe("network");
    expect(result.current.error?.retryable).toBe(true);
  });

  it("is a different error from ?state=error — the two panels must not read the same", () => {
    visit("?state=error");
    const unknown = renderHook(() => useFixture((db) => db.cards)).result.current.error;
    visit("?state=offline");
    const network = renderHook(() => useFixture((db) => db.cards)).result.current.error;

    expect(network?.title).not.toBe(unknown?.title);
  });
});

describe("useFixture — E-34, the hostile query string", () => {
  it.each(["banana", "", "success%20", "../../etc/passwd", "<script>"])(
    "?state=%s falls back to success and never throws",
    (value) => {
      visit(`?state=${value}`);
      expect(() => renderHook(() => useFixture((db) => db.cards))).not.toThrow();

      const { result } = renderHook(() => useFixture((db) => db.cards));
      expect(result.current.state).toBe("success");
      expect(result.current.data).toBe(FIXTURE_DB.cards);
    },
  );
});

describe("useFixture — the screen wiring (§13.2)", () => {
  function Probe() {
    const { state, data } = useFixture((db) => db.cards);
    return (
      <div data-testid="probe" data-screen-state={state}>
        {data === null ? "no data" : `${data.length} cards`}
      </div>
    );
  }

  it("drives data-screen-state, the attribute every state sweep keys off", () => {
    visit("?state=offline");
    renderWithProviders(<Probe />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-screen-state", "offline");
  });

  it("renders real fixture rows on the success path", () => {
    renderWithProviders(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent(`${FIXTURE_DB.cards.length} cards`);
  });
});

describe("SessionProvider — the real session, replacing the simulated one", () => {
  /**
   * `fixture-auth.tsx` is gone. Its own header promised it would be "replaced wholesale when
   * the real API arrives — this file is the single place that has to change", and that is what
   * happened: `(app)/layout.tsx` now fetches the user from `GET /profile/me` server-side and
   * passes it down.
   *
   * The contract kept deliberately: `{ status, user }`, with `user` nullable. That is why
   * swapping the provider in touched two component imports rather than two components — and
   * why the sidebar's §11 E-14 signed-out chip still has something to render.
   *
   * What is gone and cannot be tested here: `signIn` / `signOut` on the context. A session now
   * lives in an httpOnly cookie the browser cannot read, so nothing client-side can mint or
   * revoke one. Signing out is `signOutAction`, a Server Action.
   */
  function SessionProbe() {
    const session = useSession();
    return (
      <div>
        <span data-testid="status">{session.status}</span>
        <span data-testid="name">{session.user?.firstName ?? "nobody"}</span>
      </div>
    );
  }

  it("reports signed-in for the user it was handed", () => {
    renderWithProviders(
      <SessionProvider user={FIXTURE_DB.user}>
        <SessionProbe />
      </SessionProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("signed-in");
    expect(screen.getByTestId("name")).toHaveTextContent(FIXTURE_DB.user.firstName);
  });

  it("reports signed-out for a null user, so the sidebar chip has a state to render (E-14)", () => {
    renderWithProviders(
      <SessionProvider user={null}>
        <SessionProbe />
      </SessionProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("signed-out");
    expect(screen.getByTestId("name")).toHaveTextContent("nobody");
  });

  it("names the missing provider rather than rendering a confusing blank", () => {
    expect(() => renderHook(() => useSession())).toThrow(/SessionProvider/);
  });

  it("offers an optional read for surfaces that render outside the provider", () => {
    const { result } = renderHook(() => useOptionalSession());
    expect(result.current).toBeNull();
  });
});

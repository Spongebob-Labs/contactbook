import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { act, renderHook } from "@testing-library/react";
import type { Config, Driver, DriveStep } from "driver.js";
import { CARD_TOUR_STEPS, markCardTourSeen } from "@/lib/product-tour";
import { useCardTour } from "@/lib/use-card-tour";

const driverModule = vi.hoisted(() => ({ driver: vi.fn() }));

vi.mock("driver.js", () => ({ driver: driverModule.driver }));

type FakeDriver = {
  config: Config;
  drive: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

let instances: FakeDriver[] = [];

/** The four `data-tour` anchors the card page renders once its fetch resolves. */
function mountTargets(): void {
  for (const step of CARD_TOUR_STEPS) {
    const name = /\[data-tour="(?<name>[^"]+)"\]/.exec(step.element)?.groups
      ?.name;
    if (!name) {
      throw new Error(`step selector is not a data-tour hook: ${step.element}`);
    }
    const node = document.createElement("div");
    node.setAttribute("data-tour", name);
    document.body.append(node);
  }
}

/** Drives every exit path driver.js has: Done, close, Escape, overlay, destroy. */
function fireDestroyed(instance: FakeDriver): void {
  const onDestroyed = instance.config.onDestroyed;
  if (!onDestroyed) {
    throw new Error("the tour must register onDestroyed");
  }
  const step: DriveStep = instance.config.steps?.[0] ?? {};
  act(() => {
    onDestroyed(undefined, step, {
      config: instance.config,
      state: {},
      driver: instance as unknown as Driver,
      index: 0,
    });
  });
}

function stubMatchMedia(reduced: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") && reduced,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

type TourProps = { userId: string | null; enabled: boolean };

function renderTour(options: TourProps) {
  return renderHook(() => useCardTour(options));
}

/** For the tests that change props mid-flight: auth resolving, tour disabling. */
function renderTourWithProps(initialProps: TourProps) {
  return renderHook<void, TourProps>((props) => useCardTour(props), {
    initialProps,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  instances = [];
  driverModule.driver.mockImplementation((config: Config = {}) => {
    const instance: FakeDriver = {
      config,
      drive: vi.fn(),
      destroy: vi.fn(),
    };
    instances.push(instance);
    return instance as unknown as Driver;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.querySelectorAll("[data-tour]").forEach((node) => node.remove());
});

describe("useCardTour — when it stays out of the way", () => {
  it("never starts for a user who already saw it", () => {
    mountTargets();
    markCardTourSeen("user-1");

    renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(5000));

    expect(driverModule.driver).not.toHaveBeenCalled();
  });

  it("never starts without a user id, because a dismissal could not be remembered", () => {
    mountTargets();

    renderTour({ userId: null, enabled: true });
    act(() => vi.advanceTimersByTime(5000));

    expect(driverModule.driver).not.toHaveBeenCalled();
  });

  it("never starts while disabled", () => {
    mountTargets();

    renderTour({ userId: "user-1", enabled: false });
    act(() => vi.advanceTimersByTime(5000));

    expect(driverModule.driver).not.toHaveBeenCalled();
  });

  it("gives up quietly when the targets never render", () => {
    renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(10_000));

    expect(driverModule.driver).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it("starts once the card finishes loading and the targets appear", () => {
    const { result } = renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(500));
    expect(driverModule.driver).not.toHaveBeenCalled();

    mountTargets();
    act(() => vi.advanceTimersByTime(500));

    expect(driverModule.driver).toHaveBeenCalledTimes(1);
    expect(instances[0].drive).toHaveBeenCalledTimes(1);
    expect(result.current).toBeUndefined();
  });

  it("stops waiting on unmount, so a late render cannot start an orphan tour", () => {
    const { unmount } = renderTour({ userId: "user-1", enabled: true });
    unmount();

    mountTargets();
    act(() => vi.advanceTimersByTime(10_000));

    expect(driverModule.driver).not.toHaveBeenCalled();
  });

  it("starts when a late-resolving user id arrives", () => {
    mountTargets();
    const { rerender } = renderTourWithProps({ userId: null, enabled: true });
    act(() => vi.advanceTimersByTime(500));
    expect(driverModule.driver).not.toHaveBeenCalled();

    rerender({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(500));

    expect(driverModule.driver).toHaveBeenCalledTimes(1);
  });
});

describe("useCardTour — starting exactly once", () => {
  it("creates a single driver when the effect is double-invoked under StrictMode", () => {
    mountTargets();
    const effectRuns = vi.fn();

    renderHook(
      () => {
        // Proves StrictMode really is double-invoking here; without it the
        // assertion below would pass for the wrong reason. Note this needs
        // RTL's own `reactStrictMode` option — a <StrictMode> `wrapper` does
        // not double-invoke, which is exactly the trap this guards against.
        useEffect(() => {
          effectRuns();
        }, []);
        useCardTour({ userId: "user-1", enabled: true });
      },
      { reactStrictMode: true },
    );
    act(() => vi.advanceTimersByTime(1000));

    expect(effectRuns.mock.calls.length).toBeGreaterThan(1);
    expect(driverModule.driver).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(1);
    expect(instances[0].drive).toHaveBeenCalledTimes(1);
    // The surviving tour must not have been torn down by the first cleanup.
    expect(instances[0].destroy).not.toHaveBeenCalled();
  });

  it("does not restart after the user finishes it", () => {
    mountTargets();
    const { rerender } = renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(1000));
    fireDestroyed(instances[0]);

    rerender();
    act(() => vi.advanceTimersByTime(10_000));

    expect(driverModule.driver).toHaveBeenCalledTimes(1);
  });
});

describe("useCardTour — remembering that it ran", () => {
  it("marks the tour seen when the user finishes it", () => {
    mountTargets();
    renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(1000));

    expect(localStorage.length).toBe(0);
    fireDestroyed(instances[0]);

    expect(driverModule.driver).toHaveBeenCalledTimes(1);
    // Re-mounting is the real proof: the flag must survive a fresh visit.
    const second = renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(10_000));
    expect(driverModule.driver).toHaveBeenCalledTimes(1);
    second.unmount();
  });

  it("marks the tour seen when the user dismisses it half way", () => {
    mountTargets();
    renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(1000));

    fireDestroyed(instances[0]);

    renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(10_000));
    expect(driverModule.driver).toHaveBeenCalledTimes(1);
  });

  it("scopes the flag to the user, so the next account still gets its tour", () => {
    mountTargets();
    const first = renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(1000));
    fireDestroyed(instances[0]);
    first.unmount();

    renderTour({ userId: "user-2", enabled: true });
    act(() => vi.advanceTimersByTime(1000));

    expect(driverModule.driver).toHaveBeenCalledTimes(2);
  });

  it("leaves driver.js's own teardown handlers alone, so the close button still closes", () => {
    mountTargets();
    renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(1000));

    // Overriding any of these cancels driver.js's built-in destroy unless the
    // override destroys by hand — the classic way to make a tour unclosable.
    expect(instances[0].config.onDestroyStarted).toBeUndefined();
    expect(instances[0].config.onCloseClick).toBeUndefined();
    expect(instances[0].config.onDoneClick).toBeUndefined();
    expect(instances[0].config.onNextClick).toBeUndefined();
  });
});

describe("useCardTour — cleanup", () => {
  it("destroys the driver on unmount", () => {
    mountTargets();
    const { unmount } = renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(1000));
    expect(instances[0].destroy).not.toHaveBeenCalled();

    unmount();

    expect(instances[0].destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys the driver when the page disables the tour mid-run", () => {
    mountTargets();
    const { rerender } = renderTourWithProps({
      userId: "user-1",
      enabled: true,
    });
    act(() => vi.advanceTimersByTime(1000));

    rerender({ userId: "user-1", enabled: false });

    expect(instances[0].destroy).toHaveBeenCalledTimes(1);
  });
});

describe("useCardTour — driver configuration", () => {
  it("walks the pinned steps in order with their copy", () => {
    mountTargets();
    renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(1000));

    const steps = instances[0].config.steps ?? [];
    expect(steps.map((step) => step.element)).toEqual(
      CARD_TOUR_STEPS.map((step) => step.element),
    );
    expect(steps.map((step) => step.popover?.title)).toEqual(
      CARD_TOUR_STEPS.map((step) => step.title),
    );
    expect(steps.map((step) => step.popover?.description)).toEqual(
      CARD_TOUR_STEPS.map((step) => step.description),
    );
  });

  it("animates when the user has expressed no motion preference", () => {
    stubMatchMedia(false);
    mountTargets();
    renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(1000));

    expect(instances[0].config.animate).toBe(true);
  });

  it("drops the animation when the user prefers reduced motion", () => {
    stubMatchMedia(true);
    mountTargets();
    renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(1000));

    expect(instances[0].config.animate).toBe(false);
  });

  it("still starts where matchMedia does not exist", () => {
    mountTargets();
    renderTour({ userId: "user-1", enabled: true });
    act(() => vi.advanceTimersByTime(1000));

    expect(driverModule.driver).toHaveBeenCalledTimes(1);
    expect(instances[0].config.animate).toBe(true);
  });
});

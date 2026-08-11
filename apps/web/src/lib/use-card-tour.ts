/**
 * First-visit guided tour of the card page — the impure half.
 *
 * `@/lib/product-tour` owns the copy and the per-user "already seen" flag; this
 * hook owns nothing but the driver.js wiring, which keeps every rule about when
 * the tour may run testable without a browser.
 *
 * Two facts shape the implementation. The card page renders its `data-tour`
 * anchors only after an async fetch resolves, so starting on mount would
 * highlight nothing — we poll for the anchors first. And driver.js destroys
 * itself on Done, close, Escape and the overlay, so `onDestroyed` is the single
 * place that records the tour as seen.
 */

import { useEffect, useRef } from "react";
import { driver, type Config, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import {
  CARD_TOUR_STEPS,
  hasSeenCardTour,
  markCardTourSeen,
} from "@/lib/product-tour";

const POLL_INTERVAL_MS = 100;
/** Hard cap on the wait: past this the card fetch has failed or the page changed. */
const MAX_WAIT_MS = 3000;
const MAX_ATTEMPTS = Math.ceil(MAX_WAIT_MS / POLL_INTERVAL_MS);

export type UseCardTourOptions = {
  /** The signed-in user, or null while auth is still resolving. */
  userId: string | null;
  /** False whenever the page is loading, errored, or has a modal open. */
  enabled: boolean;
};

function prefersReducedMotion(): boolean {
  // Guarded rather than assumed: jsdom has no matchMedia, and a missing
  // preference should still give everyone else the animated tour.
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function everyTargetPresent(): boolean {
  return CARD_TOUR_STEPS.every(
    (step) => document.querySelector(step.element) !== null,
  );
}

function toDriveSteps(): DriveStep[] {
  return CARD_TOUR_STEPS.map((step) => ({
    element: step.element,
    popover: { title: step.title, description: step.description },
  }));
}

/**
 * Runs the card tour once, for a user who has never seen it.
 *
 * No-ops when disabled, when there is no user to scope the flag to, or when the
 * flag is already set. Safe to call on every render of the card page.
 */
export function useCardTour({ userId, enabled }: UseCardTourOptions): void {
  // Survives the StrictMode remount so a tour that already ran cannot be
  // driven a second time by the re-invoked effect.
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !userId || startedRef.current || hasSeenCardTour(userId)) {
      return;
    }

    let activeDriver: Driver | null = null;
    let timer: number | undefined;
    let attempts = 0;

    const start = (): void => {
      startedRef.current = true;
      const config: Config = {
        steps: toDriveSteps(),
        animate: !prefersReducedMotion(),
        showProgress: true,
        allowClose: true,
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Got it",
        // The one exit hook driver.js fires for every teardown path — Done, the
        // close button, Escape, the overlay, and our own unmount destroy. The
        // sibling hooks (onDestroyStarted, onCloseClick, onDoneClick) are left
        // alone on purpose: overriding them cancels driver.js's built-in
        // destroy unless the override re-destroys by hand.
        onDestroyed: () => {
          markCardTourSeen(userId);
        },
      };
      activeDriver = driver(config);
      activeDriver.drive();
    };

    const poll = (): void => {
      if (everyTargetPresent()) {
        start();
        return;
      }
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        // Give up silently: a missing tour is a far smaller failure than an
        // overlay pointing at nothing.
        return;
      }
      timer = window.setTimeout(poll, POLL_INTERVAL_MS);
    };

    // Deliberately deferred by a tick. StrictMode mounts, cleans up and mounts
    // again inside one commit, so a deferred first check lets the cleanup
    // cancel the doomed first attempt instead of tearing down a live tour.
    timer = window.setTimeout(poll, 0);

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      activeDriver?.destroy();
      activeDriver = null;
    };
  }, [enabled, userId]);
}

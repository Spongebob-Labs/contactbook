"use client";

import { useEffect } from "react";

/**
 * Ask before leaving a screen that holds unsaved changes.
 *
 * Two exits are covered, and only while `dirty` is true — no listener is registered otherwise:
 *
 * · **Closing the tab, reloading, or typing a new address** — `beforeunload`. The browser owns
 *   the wording of that prompt and shows it only after the page has had a user gesture.
 * · **Following a link inside the app.** The App Router has no route-change event to cancel
 *   (`router.events` is a Pages Router API), and `<Link onNavigate>` only reaches the links a
 *   screen renders itself — not the sidebar's or the bottom bar's. So a click on any same-origin
 *   link is caught on `document` in the capture phase, before React or `<Link>` see it, and is
 *   stopped there if the owner chooses to stay.
 *
 * Not covered: the browser's Back button inside the app (a `popstate` cannot be cancelled) and
 * programmatic `router.push` calls, which the screen that makes them is responsible for.
 */
export const LEAVE_WITH_UNSAVED_CHANGES = "You have unsaved changes. Leave without saving them?";

/** A plain left click on a link that would take the app to another page. */
export function isLeavingClick(event: MouseEvent, here: URL): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target !== "" && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  let next: URL;
  try {
    next = new URL(anchor.href, here);
  } catch {
    return false;
  }
  if (next.origin !== here.origin) return false;
  /* A jump within the page is not leaving it. */
  return next.pathname !== here.pathname || next.search !== here.search;
}

export function useUnsavedChangesGuard(
  dirty: boolean,
  message: string = LEAVE_WITH_UNSAVED_CHANGES,
): void {
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      /* Still required by some engines for the prompt to show; its text is not displayed. */
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (!isLeavingClick(event, new URL(window.location.href))) return;
      if (window.confirm(message)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}

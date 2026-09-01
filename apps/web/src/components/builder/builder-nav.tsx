"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useSearchParams } from "next/navigation";
import { LayoutPanelTop, Palette, Rows3, type LucideIcon } from "lucide-react";
import { useCallback, useState, type ReactElement } from "react";

import { cn } from "@/lib/cn";

/**
 * The builder's section rail — the icon column down the left of the control panel, and the
 * thing that switches what the panel is showing.
 *
 * ## ⚠ These ARE tabs now, and the previous version's argument is answered rather than ignored
 *
 * The first build of this rail was a **navigator**: three anchors over three sections that were
 * all mounted at once, in one long column. That was a deliberate choice and it was wrong for
 * this screen, for a reason no amount of styling fixes — **three stacked sections is one scroll
 * about two thousand pixels long**, so "choose a background" meant scrolling past the field list
 * every time, and no single view of the editor ever showed you a complete decision.
 *
 * The reason it was built that way is real and is recorded as §8D.4's last failure: *a panel
 * that only exists while its tab is selected cannot be linked to, anchored on, or found with the
 * browser's own find.* That failure is not a law against tabs; it is a law against **unaddressable
 * panels.** So the panel is addressable:
 *
 * · **The active tab lives in the URL** as `?panel=`, so `/cards/x/edit?panel=design` opens on
 *   Design — linkable, bookmarkable, and survivable across a reload. That is strictly more than
 *   the scrolling column offered, because a fragment only works if the target is on screen.
 * · **It is written with `history.replaceState`, not `router.replace`.** A Next navigation on
 *   every tab click would re-run the route and re-mount the reducer, which on this screen means
 *   throwing away the owner's unsaved edits to change tab. The URL is a *record* of the view
 *   here, never the source of truth for it.
 *
 * The other half of the old argument — *judging a colour needs the fields on screen* — is held
 * by something better than a shared scroll: the live phone is pinned beside the panel at every
 * width and never switches with the tabs. You are always looking at the card while you decide.
 *
 * ## Radix owns the keyboard, and that is why this is `@radix-ui/react-tabs`
 *
 * A vertical tab set needs a roving tabindex, Home/End, and arrow keys on the *vertical* axis —
 * `orientation="vertical"` is what tells Radix to bind Up/Down instead of Left/Right, and
 * hand-rolled tab sets get exactly that wrong. Activation is on focus (Radix's default,
 * `automatic`), which is right here: every panel is already rendered client-side and switching
 * costs nothing, so arrowing down the rail previews as it goes.
 *
 * ## Two shapes, one component
 *
 * An 84px icon column is right beside a panel and wrong above one, so below `lg` the same list
 * renders as a horizontal segmented control across the top of the panel. Same `Tabs.List`, same
 * items, same values — only the axis and the item's internals differ, so the two cannot come to
 * disagree about what the sections are.
 */

export interface BuilderSectionDef {
  /** The tab's value, its panel's `data-builder-section`, and its `?panel=` spelling. */
  id: BuilderSectionId;
  label: string;
  /** The one-line answer to "what do I change in here", under the panel's own title. */
  intro: string;
  icon: LucideIcon;
}

export type BuilderSectionId = "fields" | "design" | "layout";

/**
 * The sections, in the order the work happens: choose what the card carries, choose what it
 * looks like carrying it, then choose how much of that you see.
 *
 * ⚠ **One array, read by the rail and by `builder-client.tsx`.** A tab with no panel behind it
 * is an empty box, and a panel with no tab is unreachable — both are silent, and both are
 * impossible while there is one list. The intro copy lives here too, so the rail and the panel
 * heading cannot come to describe the same section differently.
 */
export const BUILDER_SECTIONS: readonly BuilderSectionDef[] = [
  {
    id: "fields",
    label: "Fields",
    intro:
      "What this card shares, in the order it appears. Values come from your profile — editing one here changes it on every card that uses it.",
    icon: Rows3,
  },
  {
    id: "design",
    label: "Design",
    intro:
      "The colour this card wears and how it is painted. Every ink, button and line is derived from your colour, so the card stays readable whatever you pick.",
    icon: Palette,
  },
];

/** The `?panel=` key. One constant, read by the parser and written by the recorder. */
export const PANEL_PARAM = "panel";

const DEFAULT_SECTION: BuilderSectionId = BUILDER_SECTIONS[0].id;

/** `?panel=nonsense` opens on Fields rather than on an empty panel (§11 E-34's rule). */
function parseSection(raw: string | null): BuilderSectionId {
  const match = BUILDER_SECTIONS.find((section) => section.id === raw);
  return match?.id ?? DEFAULT_SECTION;
}

/**
 * The active section, and the setter that records it in the URL.
 *
 * ⚠ The initial value comes from `useSearchParams()` rather than from `location.search`, because
 * it has to be the same on the server pass and the first client pass — reading `location` during
 * render is a hydration mismatch, and reading it in an effect is a visible flash of the wrong
 * panel on any link that named one.
 */
export function useBuilderSection(): {
  section: BuilderSectionId;
  setSection: (next: BuilderSectionId) => void;
} {
  const searchParams = useSearchParams();
  const [section, setLocal] = useState<BuilderSectionId>(() =>
    parseSection(searchParams.get(PANEL_PARAM)),
  );

  const setSection = useCallback((next: BuilderSectionId) => {
    setLocal(next);

    /* ⚠ `history.replaceState`, and every word of that matters.

       `replace` rather than `push`: switching tab is not a place you should have to press Back
       out of three times to leave the editor.

       `history` rather than `router`: a Next navigation re-runs the route, which re-mounts the
       builder's reducer and discards unsaved edits — changing tab would silently reset the card.
       Next 16 supports the native call for exactly this case (a URL that records the view rather
       than selecting it).

       Guarded because this also runs under happy-dom in the unit suite, where `history` exists
       but the URL is `about:blank` and `URL` construction throws. */
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set(PANEL_PARAM, next);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* A URL we cannot parse is a URL we cannot record into. The tab still changed. */
    }
  }, []);

  return { section, setSection };
}

/**
 * The rail. Rendered inside a `Tabs.Root` owned by `builder-client.tsx` — Radix requires the
 * list and the panels to share one root, and the root is where the state lives.
 */
export function BuilderNav(): ReactElement {
  return (
    <TabsPrimitive.List
      data-builder-nav=""
      aria-label="Card sections"
      className={cn(
        "flex shrink-0 gap-1",
        // Desktop: a column beside the panel, pinned so it does not scroll away from it.
        "lg:sticky lg:top-6 lg:w-[84px] lg:flex-col lg:self-start lg:gap-1.5",
        // Mobile: a segmented control on a well, sized to its contents so it reads as a
        // control rather than as a container that failed to fill.
        "w-fit max-w-full overflow-x-auto rounded-full border border-line bg-surface-sunk p-1",
        "lg:w-[84px] lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0",
      )}
    >
      {BUILDER_SECTIONS.map((section) => {
        const Icon = section.icon;

        return (
          <TabsPrimitive.Trigger
            key={section.id}
            value={section.id}
            data-builder-nav-item={section.id}
            className={cn(
              // `min-h-11` on the phone shape: 44px is the pointer-target floor, and the pill's
              // own padding lands it at 36. The desktop rail is already taller than that from
              // its glyph chip, so the floor is dropped there rather than padding a column item
              // that does not need it.
              "group flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3.5 py-2",
              "lg:min-h-0",
              "text-sm whitespace-nowrap transition-colors duration-[var(--dur-fast)] ease-out",
              "lg:w-full lg:flex-col lg:gap-1.5 lg:rounded-xl lg:px-1 lg:py-2.5 lg:text-xs",
              // Mobile pill: the selected item is a raised white chip on the sunk well.
              "text-ink-3 data-[state=active]:bg-canvas data-[state=active]:text-ink",
              "data-[state=active]:shadow-[var(--elevation-1)]",
              // Desktop: no pill on the item at all — the glyph chip below carries the state,
              // which is what keeps an 84px rail readable at a glance.
              "lg:data-[state=active]:bg-transparent lg:data-[state=active]:shadow-none",
              "lg:hover:bg-surface-sunk lg:data-[state=active]:hover:bg-transparent",
              "hover:text-ink",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
                "transition-colors duration-[var(--dur-fast)] ease-out",
                "max-lg:hidden",
                "bg-surface-sunk text-ink-3 group-hover:text-ink",
                "group-data-[state=active]:bg-accent group-data-[state=active]:text-accent-ink",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={1.75} />
            </span>
            {/* The mobile shape puts the glyph inline with the label instead of above it. */}
            <Icon aria-hidden="true" className="size-4 shrink-0 lg:hidden" strokeWidth={1.75} />
            <span className="truncate font-medium">{section.label}</span>
          </TabsPrimitive.Trigger>
        );
      })}
    </TabsPrimitive.List>
  );
}

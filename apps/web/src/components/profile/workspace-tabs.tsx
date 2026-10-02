"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useSearchParams } from "next/navigation";
import { Palette, Rows3, Share2, type LucideIcon } from "lucide-react";
import { useCallback, useState, type ReactElement } from "react";

import { PANEL_PARAM } from "@/components/builder/builder-nav";
import { cn } from "@/lib/cn";

/**
 * The three panels of the Profile & Cards workspace — **Fields, Design, Share** — and the tab
 * list that switches between them.
 *
 * Client, 2026-09-30: Share and Design used to be links out to `/cards/{id}` and
 * `/cards/{id}/edit?panel=design`. *"There should be no redirection … Design could be adjusted
 * on the left side of this particular card, where the different fields come over."* So all three
 * are panels in the left column, and the card on the right stays put and answers every edit.
 *
 * The open panel is in the URL as `?panel=`, written with `history.replaceState` for the reason
 * `builder-nav.tsx` gives: a Next navigation re-runs the route and remounts the workspace, which
 * would drop a half-typed edit on every tab switch.
 */

export type WorkspacePanelId = "fields" | "design" | "share";

export interface WorkspacePanelDef {
  id: WorkspacePanelId;
  label: string;
  icon: LucideIcon;
}

export const WORKSPACE_PANELS: readonly WorkspacePanelDef[] = [
  { id: "fields", label: "Fields", icon: Rows3 },
  { id: "design", label: "Design", icon: Palette },
  { id: "share", label: "Share", icon: Share2 },
];

const DEFAULT_PANEL: WorkspacePanelId = "fields";

function parsePanel(raw: string | null): WorkspacePanelId {
  return WORKSPACE_PANELS.find((panel) => panel.id === raw)?.id ?? DEFAULT_PANEL;
}

export function useWorkspacePanel(): {
  panel: WorkspacePanelId;
  setPanel: (next: WorkspacePanelId) => void;
} {
  const searchParams = useSearchParams();
  const [panel, setLocal] = useState<WorkspacePanelId>(() =>
    parsePanel(searchParams.get(PANEL_PARAM)),
  );

  const setPanel = useCallback((next: WorkspacePanelId) => {
    setLocal(next);
    /* Guarded for happy-dom, where the URL is `about:blank` and `URL` construction throws. */
    try {
      const url = new URL(window.location.href);
      if (next === DEFAULT_PANEL) url.searchParams.delete(PANEL_PARAM);
      else url.searchParams.set(PANEL_PARAM, next);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* The panel still changed; only the record of it did not. */
    }
  }, []);

  return { panel, setPanel };
}

/**
 * A segmented control on a sunk well. On a phone it fills the row in three equal thirds, so each
 * target is a third of the screen wide rather than a word wide.
 */
export function WorkspaceTabList(): ReactElement {
  return (
    <TabsPrimitive.List
      data-workspace-tabs=""
      aria-label="Workspace panels"
      className={cn(
        "grid w-full grid-cols-3 gap-1 rounded-full border border-line bg-surface-sunk p-1",
        "sm:inline-grid sm:w-auto sm:self-start sm:grid-cols-[repeat(3,minmax(7.5rem,auto))]",
      )}
    >
      {WORKSPACE_PANELS.map((panel) => {
        const Icon = panel.icon;
        return (
          <TabsPrimitive.Trigger
            key={panel.id}
            value={panel.id}
            data-workspace-tab={panel.id}
            className={cn(
              "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full px-4",
              "text-sm font-medium whitespace-nowrap text-ink-3",
              "transition-[color,background-color,box-shadow] duration-[var(--dur-fast)] ease-out",
              "hover:text-ink",
              "data-[state=active]:bg-canvas data-[state=active]:text-ink",
              "data-[state=active]:shadow-[var(--elevation-1)]",
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
            {panel.label}
          </TabsPrimitive.Trigger>
        );
      })}
    </TabsPrimitive.List>
  );
}

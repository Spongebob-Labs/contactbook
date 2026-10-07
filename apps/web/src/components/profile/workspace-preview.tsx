"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState, type ReactElement } from "react";

import { BuilderPreview } from "@/components/builder/builder-preview";
import { buttonClassName } from "@/components/primitives/button";
import { cn } from "@/lib/cn";
import type { ResolvedCard } from "@/types/domain";

import { CardSwitcher, type SwitcherCard } from "./card-switcher";

/**
 * The right-hand half of the workspace: which card, and how it looks right now.
 *
 * ⚠ **No links out.** "Share" and "Design" used to sit here as links to `/cards/{id}` and
 * `/cards/{id}/edit?panel=design`, and the client read both as the page throwing them somewhere
 * else (2026-09-30). They are the workspace's own Share and Design panels now, beside the Fields
 * one on the left; this column only ever shows the card those panels are editing.
 *
 * ## The preview is the builder's
 *
 * `<BuilderPreview>` is the same card page in the same frame `/cards/{id}/edit` shows, fed the
 * one `ResolvedCard` the workspace resolves. A field edited on the left, or switched on for this
 * card, is on the preview in the same frame — before it is saved, because the preview shows the
 * draft the **Save changes** button would commit.
 *
 * ## On a phone it can fold away
 *
 * Below `lg` this whole block is pinned to the top of the screen, above the fields. The preview
 * starts open, because seeing the card change is the point. "Hide preview" folds it to the card
 * row alone for anyone who wants the height back. The fold is CSS below `lg` only; from `lg` up
 * the preview is always shown.
 */

export interface WorkspacePreviewProps {
  cards: readonly SwitcherCard[];
  selectedId: string | null;
  onSelect: (cardId: string) => void;
  onCreate: (name: string) => Promise<boolean>;
  creating: boolean;
  /** `null` when there is no card to show. */
  resolved: ResolvedCard | null;
  /**
   * A field just switched on. The preview scrolls its frame to that row, because on a phone the
   * frame shows little more than the card's top and the new row would land out of sight.
   */
  spotlight?: { fieldId: string; nonce: number } | null;
}

export function WorkspacePreview({
  cards,
  selectedId,
  onSelect,
  onCreate,
  creating,
  resolved,
  spotlight = null,
}: WorkspacePreviewProps): ReactElement {
  const [folded, setFolded] = useState(false);
  const cardId = resolved === null ? null : selectedId;
  const hostRef = useRef<HTMLDivElement>(null);

  /* A different card starts at its top, not wherever the last one was scrolled to. */
  useEffect(() => {
    hostRef.current?.querySelector<HTMLElement>("[data-preview-frame]")?.scrollTo({ top: 0 });
  }, [selectedId]);

  useEffect(() => {
    if (spotlight === null) return;
    const frame = hostRef.current?.querySelector<HTMLElement>("[data-preview-frame]");
    const row = frame?.querySelector<HTMLElement>(
      `[data-card-field="${CSS.escape(spotlight.fieldId)}"]`,
    );
    if (frame === null || frame === undefined || row === null || row === undefined) return;
    const offset =
      row.getBoundingClientRect().top - frame.getBoundingClientRect().top + frame.scrollTop;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    frame.scrollTo({
      top: Math.max(0, offset - frame.clientHeight / 3),
      behavior: reduce ? "auto" : "smooth",
    });
  }, [spotlight]);

  return (
    <div data-workspace-preview="" className="flex flex-col gap-2 lg:gap-3">
      <CardSwitcher
        cards={cards}
        selectedId={selectedId}
        onSelect={onSelect}
        onCreate={onCreate}
        creating={creating}
        startComposing={cards.length === 0}
      />

      {/* Below `lg` only: the one control here is the fold, and from `lg` up there is nothing to
          fold. (This row used to carry the autosave's "Saving… / Saved" line on every width.) */}
      {cardId === null ? null : (
        <div className="flex min-h-8 items-center gap-1 lg:hidden">
          <div className="ms-auto flex items-center gap-1">
            <button
              type="button"
              data-workspace-preview-fold=""
              aria-expanded={!folded}
              aria-controls="workspace-preview-frame"
              onClick={() => setFolded((current) => !current)}
              className={buttonClassName({
                variant: "ghost",
                className: "h-8 gap-1.5 px-2.5 text-sm max-md:h-9 lg:hidden",
              })}
            >
              {folded ? (
                <ChevronDown aria-hidden="true" className="size-4" />
              ) : (
                <ChevronUp aria-hidden="true" className="size-4" />
              )}
              {folded ? "Show preview" : "Hide preview"}
            </button>
          </div>
        </div>
      )}

      {resolved === null ? (
        <div
          data-workspace-preview-empty=""
          className="flex h-40 items-center justify-center rounded-[26px] border border-dashed border-line-control text-sm text-ink-3 max-lg:hidden"
        >
          No cards yet
        </div>
      ) : (
        <div
          ref={hostRef}
          id="workspace-preview-frame"
          data-workspace-preview-frame=""
          className={cn(
            "h-[var(--builder-preview-h)] lg:h-auto",
            folded && "max-lg:hidden",
          )}
        >
          <BuilderPreview resolved={resolved} />
        </div>
      )}
    </div>
  );
}

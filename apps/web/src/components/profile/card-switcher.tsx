"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button, Input, TOUCH_HIT_44_Y } from "@/components/primitives";
import { cn } from "@/lib/cn";

/**
 * Which card the workspace is previewing, and the way to make another.
 *
 * ## One row of names, not a dropdown
 *
 * The cards are few and their names are short, so each one is a pill you can press rather than
 * an option hidden behind a menu. The row scrolls sideways when it runs out of width (a mouse
 * wheel scrolls it too), and the chosen card is kept in view.
 *
 * ## "New card" asks for a name, in place
 *
 * The row turns into one input and a Create button. The card is created with every filled-in
 * field already on it, so a name is the only question.
 */

export interface SwitcherCard {
  id: string;
  name: string;
}

export interface CardSwitcherProps {
  cards: readonly SwitcherCard[];
  selectedId: string | null;
  onSelect: (cardId: string) => void;
  /** Resolves `true` when the card was created, so the form can close. */
  onCreate: (name: string) => Promise<boolean>;
  creating: boolean;
  /** Opens the name form on mount — the no-cards state has nothing else to show. */
  startComposing?: boolean;
}

const NAME_MAX = 60;

/** A 28px fade at whichever ends hide more pills. `undefined` when the row fits. */
function fadeMask(edges: { start: boolean; end: boolean }): string | undefined {
  if (!edges.start && !edges.end) return undefined;
  const start = edges.start ? "transparent, #000 28px" : "#000, #000";
  const end = edges.end ? "#000 calc(100% - 28px), transparent" : "#000, #000";
  return `linear-gradient(to right, ${start}, ${end})`;
}

export function CardSwitcher({
  cards,
  selectedId,
  onSelect,
  onCreate,
  creating,
  startComposing = false,
}: CardSwitcherProps) {
  const [composing, setComposing] = useState(startComposing);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  /* Keep the chosen pill on screen when the selection changes, or the row first renders. */
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null || selectedId === null) return;
    const pill = scroller.querySelector<HTMLElement>(`[data-card-switch="${CSS.escape(selectedId)}"]`);
    if (pill === null) return;
    const left = pill.offsetLeft - scroller.offsetLeft;
    const right = left + pill.offsetWidth;
    if (left < scroller.scrollLeft) scroller.scrollLeft = left;
    else if (right > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollLeft = right - scroller.clientWidth;
    }
  }, [selectedId, cards.length, composing]);

  /* Which ends have more pills past them, so the row can fade there and admit it scrolls. */
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    const read = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      const next = { start: scroller.scrollLeft > 2, end: scroller.scrollLeft < max - 2 };
      setEdges((current) =>
        current.start === next.start && current.end === next.end ? current : next,
      );
    };
    read();
    scroller.addEventListener("scroll", read, { passive: true });
    const observer = new ResizeObserver(read);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", read);
      observer.disconnect();
    };
  }, [composing, cards.length]);

  /* A vertical wheel moves a row that only scrolls sideways. Passive-safe: only when it can. */
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (scroller.scrollWidth <= scroller.clientWidth) return;
      event.preventDefault();
      scroller.scrollLeft += event.deltaY;
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [composing]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Give the card a name.");
      return;
    }
    setError(null);
    void onCreate(trimmed).then((created) => {
      if (created) {
        setName("");
        setComposing(false);
      }
    });
  }

  if (composing) {
    return (
      <form
        data-card-switcher-new=""
        aria-label="New card"
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === "Escape" && cards.length > 0) {
            event.preventDefault();
            setComposing(false);
          }
        }}
        className="flex min-w-0 items-start gap-2"
      >
        <Input
          autoFocus
          label="Card name"
          hideLabel
          data-card-switcher-name=""
          value={name}
          maxLength={NAME_MAX}
          placeholder="Card name"
          error={error ?? undefined}
          autoComplete="off"
          onChange={(event) => {
            setName(event.target.value);
            if (error !== null) setError(null);
          }}
          fieldClassName="min-w-0 flex-1"
        />
        <Button type="submit" data-card-switcher-create="" loading={creating} loadingLabel="Creating…">
          Create
        </Button>
        {cards.length === 0 ? null : (
          <Button
            type="button"
            variant="ghost"
            iconOnly
            aria-label="Cancel new card"
            onClick={() => {
              setComposing(false);
              setError(null);
            }}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        )}
      </form>
    );
  }

  return (
    <div data-card-switcher="" className="flex min-w-0 items-center gap-2">
      <div
        ref={scrollerRef}
        role="radiogroup"
        aria-label="Card to preview"
        onKeyDown={(event) => {
          /* A radio group moves with the arrow keys and is one tab stop, like every other. */
          const step =
            event.key === "ArrowRight" || event.key === "ArrowDown"
              ? 1
              : event.key === "ArrowLeft" || event.key === "ArrowUp"
                ? -1
                : 0;
          if (step === 0 || cards.length === 0) return;
          event.preventDefault();
          const at = Math.max(0, cards.findIndex((card) => card.id === selectedId));
          const next = cards[(at + step + cards.length) % cards.length];
          onSelect(next.id);
          scrollerRef.current
            ?.querySelector<HTMLElement>(`[data-card-switch="${CSS.escape(next.id)}"]`)
            ?.focus();
        }}
        style={{ maskImage: fadeMask(edges), WebkitMaskImage: fadeMask(edges) }}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {cards.map((card, index) => {
          const active = card.id === selectedId;
          const tabbable = active || (selectedId === null && index === 0);
          return (
            <button
              key={card.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={tabbable ? 0 : -1}
              data-card-switch={card.id}
              onClick={() => onSelect(card.id)}
              title={card.name}
              className={cn(
                "inline-flex h-8 max-w-44 shrink-0 items-center rounded-full border px-3 text-sm",
                "transition-colors duration-[var(--dur-fast)]",
                TOUCH_HIT_44_Y,
                active
                  ? "border-accent bg-accent text-ink-inverse"
                  : "border-line-control bg-canvas text-ink-2 hover:border-accent hover:text-ink",
              )}
            >
              <span className="truncate">{card.name}</span>
            </button>
          );
        })}
      </div>

      <Button
        variant="secondary"
        data-card-switcher-open=""
        onClick={() => setComposing(true)}
        className="shrink-0"
      >
        <Plus aria-hidden="true" className="size-4" />
        New card
      </Button>
    </div>
  );
}

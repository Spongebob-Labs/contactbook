import type { ComponentPropsWithoutRef, Ref } from "react";

import { LIVE_CARD_SLOTS, type LiveCardRow } from "@/fixtures/marketing";

import { mkcn } from "./mk-cn";

/**
 * The contact card, as an object. Presentational and stateless.
 *
 * ## Why this exists separately from `<LiveCard>`
 * Two surfaces need this card and they need it for opposite reasons: the hero animates it
 * through a script of beats, and `problem` shows one still frame of it as the "after" half of a
 * before/after. Extracted, there is ONE card in the marketing layer with one set of slot
 * geometry and one set of state rules — `<LiveCard>` became a driver that owns a timer and
 * nothing else. A second hand-built card in `problem.tsx` would have drifted from this one the
 * first time either changed.
 *
 * ## It is not `<ShareFace>` or `<CardPage>`, and the reasons are mechanical
 *   · `<ShareFace>` is a 336×500 wallet pass whose QR has ONE pixel of clearance over the
 *     140px scannable floor. Any transform on an ancestor spends headroom that does not exist,
 *     and a moving QR is unscannable at any size. Animating rows inside it means building on
 *     the one part of the system with no slack in it.
 *   · `<CardPage>` prints an actionable field's LABEL, not its value — "Email", not the address
 *     — which was a deliberate product decision. So "her email changed" is invisible on it, and
 *     that is the exact thing both of these surfaces exist to show.
 *
 * So this is a marketing rendition and it is honest about being one: no QR anywhere on it, and
 * every colour is the Emerald palette's own value rather than a green mixed for this page, so
 * the one thing that could drift out of sync with the product cannot.
 *
 * ## The geometry is a contract, not a style
 * The row stack is fixed at `LIVE_CARD_SLOTS` rows whether three are filled or four, so a row
 * arriving or being revoked moves no other box on the page. Every animated property is
 * `transform` or `opacity`. Both rules live in `marketing.css` under `.mk-live-*`; read the
 * block there before changing a number here.
 */

/** One row's slot height, and the clip a value rolls inside. Consumed by `marketing.css`. */
const GEOMETRY = { rowHeight: 56, valueHeight: 22 } as const;

/** Initials for the monogram. A card may carry a business name, so never assume two words. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts.at(-1)![0]! : "";
  return (first + last).toUpperCase();
}

export interface ContactCardProps extends ComponentPropsWithoutRef<"div"> {
  /** React 19 passes `ref` as an ordinary prop, so no `forwardRef` wrapper is needed. */
  ref?: Ref<HTMLDivElement>;
  name: string;
  role: string;
  /** The brand chip's letters. */
  mark: string;
  rows: readonly LiveCardRow[];
  /**
   * Suppresses row transitions for this render. Set by `<LiveCard>` on the beat the loop
   * returns to; a still card never needs it.
   */
  reset?: boolean;
}

export function ContactCard({
  name,
  role,
  mark,
  rows,
  reset,
  className,
  style,
  ref,
  ...rest
}: ContactCardProps) {
  return (
    <div
      ref={ref}
      data-live-card=""
      data-reset={reset ? "" : undefined}
      className={mkcn("mk-live-frame", className)}
      style={{
        ["--lc-row" as string]: `${GEOMETRY.rowHeight}px`,
        ["--lc-val" as string]: `${GEOMETRY.valueHeight}px`,
        ["--lc-slots" as string]: LIVE_CARD_SLOTS,
        ...style,
      }}
      {...rest}
    >
      <div className="mk-live-head">
        <span className="mk-live-mark">{mark}</span>
        {/*
          A monogram, not a photograph. `/portraits/*.png` are generic silhouette placeholders
          and at 48px they read as exactly that, on the one object whose job is to look like a
          card somebody actually carries. It is also what the product does — `<ShareFace>` falls
          back portrait → monogram — and it means the first viewport makes no image request at
          all. Swap in real photography the moment the client sends it.
        */}
        <span className="mk-live-portrait" aria-hidden="true">
          {initialsOf(name)}
        </span>
      </div>

      <p className="mk-live-role">{role}</p>
      <p className="mk-live-name">{name}</p>

      <div className="mk-live-rows">
        {rows.map((row, slot) => (
          <div
            key={row.id}
            className="mk-live-row"
            data-state={row.state}
            style={{ ["--lc-slot" as string]: slot }}
          >
            <span className="mk-live-label">{row.label}</span>

            {/* Keyed by the VALUE, so the clip remounts exactly when the value changes and the
                roll plays for that row alone. Keyed by the beat it would replay on every row
                every beat; keyed by the row id it would never play at all. */}
            <span className="mk-live-value" key={row.value}>
              {row.was ? (
                <span className="mk-live-roll">
                  <span className="mk-live-line" data-was="">
                    {row.was}
                  </span>
                  <span className="mk-live-line">{row.value}</span>
                </span>
              ) : (
                <span className="mk-live-line">{row.value}</span>
              )}
            </span>

            {/* Drawn, never glyphed — DESIGN.md's icon rule. A tick for a field just corrected,
                a slash for one that has gone stale, nothing otherwise. The slot is reserved
                either way so a row does not re-lay-out when a flag appears. */}
            <span className="mk-live-flag" aria-hidden="true">
              {row.state === "updated" ? (
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                  <path
                    d="M3 8.5 6.2 11.5 13 4.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : row.state === "stale" ? (
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
                  <path d="M4.5 11.5 11.5 4.5" stroke="currentColor" strokeWidth="2" />
                </svg>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

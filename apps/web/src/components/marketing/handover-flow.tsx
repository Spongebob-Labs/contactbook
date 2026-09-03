"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { CardPage } from "@/card/card-page";
import { ShareFace } from "@/card/share-face";
import { handover } from "@/fixtures/marketing";
import type { ResolvedCard } from "@/types/domain";

import { mkcn } from "./mk-cn";

/**
 * **The hand-over flow — the diagram in the `broadcast` pass.**
 *
 *     ┌────────┐              ┌────────┐
 *     │  pass  │ ──── scan ──▶│  card  │
 *     └────────┘              └────────┘
 *          ▲                       │
 *          └─── you edit it ───────┘
 *
 * ## ⚠ THIS IS A REBUILD. THE FIRST VERSION WAS REJECTED OUTRIGHT AND THE REASONS MATTER.
 *
 * The client's words: *"the worst diagram that you can just make… so glitchy, so irrelevant…
 * It's so text-heavy. Why is this API endpoint also given here?"* Every charge was correct and
 * each one has a specific cause worth recording, because each is easy to reintroduce:
 *
 *   · **It shipped REST routes on a marketing page.** `GET /v1/public/links/:token` and
 *     `POST /v1/cards/:id/notify` were set in mono under the steps. The brief said the diagram
 *     should be *"a little bit technical"*, which means *precise and well-built* — it does not
 *     mean the reader, who is deciding whether to hand out their phone number, should be shown
 *     the backend. There are no routes in this file and none may be added.
 *   · **It added text while claiming to remove it.** Five ordinals, five titles, five
 *     sentences, three mono lines and a note: ~100 words, replacing a 45-word paragraph. The
 *     brief was *"not very text-heavy"*. The budget is now **11 words**, and `handover` in the
 *     fixture is where that is enforced.
 *   · **It was mostly empty.** Two 420px devices and 45%-opacity hairlines strung across the
 *     full 1200px column left vast holes of Pistachio between the objects; nothing held
 *     together, which is what "glitchy" was describing. The rail is now centred and capped at
 *     42rem, and the devices are 176px. Density, not sprawl.
 *   · **The fourth node read as a broken loading state.** A grey skeleton of bars, meant to be
 *     "their address book", looked exactly like a component that had failed to load. Deleted
 *     rather than restyled — see below.
 *   · **Five stages for a three-step story.** The brief described three beats: bring the pass
 *     up, they scan, the card opens. It is three, plus the return.
 *   · **Selection painted a tinted rectangle behind a column**, which read as a stray box. It
 *     is now a lift and a shadow on the object itself.
 *
 * ## What the drawing says, and why it is two objects rather than four
 * The whole product in one picture: an object you hand over, a scan, the page it opens, and an
 * arrow going **back** because you can change it afterwards. The return is the argument — it
 * re-enters at the card, not at the pass, because the recipient's link never changes and the
 * page behind it resolves from current data at request time. Drawn as a ring it would say the
 * opposite, that something circulates on its own, which is the exact claim
 * `broadcast.heading` exists to refuse.
 *
 * The address-book node is gone and its absence is deliberate: the arrow leaving the card is a
 * thing leaving our system, and drawing a fake row of somebody else's app was both the ugliest
 * object on the page and the only one that was not real.
 *
 * ## ⚠ THE TWO OBJECTS ARE THE PRODUCT'S OWN RENDERS AND THAT IS NOT DECORATION
 * A real `<ShareFace>` and a real `<CardPage>`, resolved from the same `ResolvedCard` the
 * `how-it-works` studio uses, so the pass in the diagram and the page it opens cannot disagree
 * about whose card this is. `step-list.tsx`'s ban applies in full: no stock photography, no
 * illustration of a screen, no drawing of a card. The bezels are CSS because a bezel is
 * furniture; everything inside them is the product.
 *
 * ⚠ The QR is `mode="thumb"` because a scaled face is under `MIN_QR_SIZE_PX` and is therefore
 * not a scanning target. It is not fake: `qr-zone.tsx` deliberately removed the dummy payload
 * it once substituted, on the grounds that a symbol encoding a lie is worse than a small true
 * one. The page's one genuinely scannable symbol stays in the `how-it-works` scan cell.
 *
 * ## Motion: one pass through the sequence, then it belongs to the reader
 * Everything is painted, at rest, at full opacity, with no JavaScript — `mk-motion.tsx`'s
 * first rule. The autoplay only moves emphasis, and `prefers-reduced-motion` skips it. No
 * `data-mk-reveal-move` is added, so the closed scroll vocabulary stays closed at two.
 */

/* ── geometry ────────────────────────────────────────────────────────────────
   Small and fixed. The rejected build's devices were 208×420 and the sprawl
   they created was half of what was wrong with it. */

const DEVICE_W = 176;
const DEVICE_H = 356;
const BEZEL = 8;
const SCREEN_W = DEVICE_W - BEZEL * 2;
const SCREEN_H = DEVICE_H - BEZEL * 2;

/**
 * The pass, near the top of the glass — where a wallet puts its top pass.
 *
 * ⚠ Sized against the SCREEN, not picked. At 132 in a 160px screen the pass left 150px of bare
 * glass beneath it and the device read as switched on and empty, which unbalanced it against
 * the full-bleed card page beside it. A wallet's top pass is close to full width.
 */
const PASS_W = 148;
const PASS_TOP = 16;

/** `<CardPage>` is fluid; it renders at a real phone width and is scaled, never re-laid-out. */
const PAGE_NATURAL_W = 320;

export interface HandoverFlowProps {
  /** The same `ResolvedCard` the `how-it-works` studio resolves from (I-5). */
  resolved: ResolvedCard;
}

export function HandoverFlow({ resolved }: HandoverFlowProps) {
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLElement | null>(null);
  const played = useRef(false);

  /**
   * One walk through the three steps, the first time the diagram is reached.
   *
   * A flow diagram has one thing to teach that a still picture cannot — that it is a sequence —
   * so it shows its own order once and then rests. It only ever changes emphasis: nothing
   * appears, nothing disappears, and every step is legible at every frame including the first.
   *
   * ⚠ `rootMargin` watches the middle band of the viewport rather than a ratio of the element.
   * An `IntersectionObserver` ratio is the fraction of the ELEMENT visible, so an element
   * taller than the viewport can never reach a high threshold — the previous `threshold: 0.5`
   * capped at 0.42 on a phone and the sequence never played there at all, while desktop
   * reached 0.84 and looked fine. This is independent of the diagram's height.
   */
  useEffect(() => {
    const node = rootRef.current;
    if (node == null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timers: ReturnType<typeof setTimeout>[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || played.current) continue;
          played.current = true;
          observer.disconnect();
          timers = handover.steps.map((_, i) => setTimeout(() => setActive(i), i * 900));
          timers.push(setTimeout(() => setActive(handover.steps.length), handover.steps.length * 900));
        }
      },
      { threshold: 0, rootMargin: "-25% 0px -25% 0px" },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  const [pass, scan, card] = handover.steps;
  /* The return is the last stop in the sequence, so it is one past the three steps. */
  const LOOP = handover.steps.length;

  return (
    <figure ref={rootRef} data-handover-flow="" className="m-0 mt-12 flex flex-col md:mt-14">
      <figcaption className="sr-only">{handover.caption}</figcaption>

      {/* ⚠ CENTRED AND CAPPED, NOT STRETCHED ACROSS THE COLUMN.
          The pass is 1200px wide; the diagram is not. Letting the rail fill it is what put
          200px of empty Pistachio between every object in the rejected build. */}
      <div className="mx-auto w-full max-w-[42rem]">
        <ol
          data-flow-rail=""
          className={mkcn(
            "flex list-none flex-col items-center gap-0 p-0",
            "sm:flex-row sm:items-start sm:justify-center",
          )}
        >
          <Step step={pass} index={0} active={active} onPick={setActive}>
            <Device lit={active === 0}>
              <WalletScreen resolved={resolved} />
            </Device>
          </Step>

          {/* The scan is the transition, so it IS the connector rather than a node beside one. */}
          <Step step={scan} index={1} active={active} onPick={setActive} connector>
            <Arrow lit={active === 1} />
          </Step>

          <Step step={card} index={2} active={active} onPick={setActive}>
            <Device lit={active === 2}>
              <CardScreen resolved={resolved} />
            </Device>
          </Step>
        </ol>

        <ReturnPath
          label={handover.loop}
          active={active === LOOP}
          onPick={() => setActive(LOOP)}
        />
      </div>
    </figure>
  );
}

/* ── a step ──────────────────────────────────────────────────────────────────── */

/**
 * An object (or the arrow between two) and its label. Nothing else.
 *
 * ⚠ There is no ordinal, no body copy and no second line. The rejected build had all three per
 * step and that is what made a diagram read as a wall of text — see the module note. The whole
 * cell is the control, so the press target is the object a reader is already looking at.
 *
 * `aria-current="step"` is the role-accurate way to say which of an ordered sequence is
 * showing; `aria-pressed` would describe a toggle that stays down, which this is not.
 */
function Step({
  step,
  index,
  active,
  onPick,
  connector = false,
  children,
}: {
  step: { id: string; label: string };
  index: number;
  active: number;
  onPick: (i: number) => void;
  /** The middle cell: an arrow, which centres on the devices' midline rather than filling. */
  connector?: boolean;
  children: ReactNode;
}) {
  const on = active === index;

  return (
    <li className={mkcn("flex min-w-0 flex-col", connector && "sm:flex-1 sm:max-w-40")}>
      <button
        type="button"
        data-flow-step={step.id}
        aria-current={on ? "step" : undefined}
        onClick={() => onPick(index)}
        onFocus={() => onPick(index)}
        onMouseEnter={() => onPick(index)}
        className={mkcn(
          "flex cursor-pointer flex-col items-center gap-4 rounded-mk-row p-2",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-ink",
        )}
      >
        {/* One slot height across the row, so the three labels sit on one line whatever is
            above them. The arrow centres in it; the devices sit at its foot. */}
        <span
          className={mkcn(
            "flex w-full items-center justify-center",
            "sm:h-[var(--flow-slot)]",
            connector ? "py-6 sm:py-0" : "sm:items-end",
          )}
          style={{ "--flow-slot": `${DEVICE_H}px` } as CSSProperties}
        >
          {children}
        </span>

        {/*
          The label. ⚠ Two to four words, and `text-mk-ink` at full strength is mandatory —
          Pistachio is a wash, where `--mk-stone` measures 2.30–3.07:1 and there is no
          secondary text level available at all (see `SectionProps.tone`). So the resting state
          is opacity, not a lighter ink: 70% of Onyx on this ground still clears AA at this
          size, and a step that is not current should recede without becoming illegible.
        */}
        <span
          className={mkcn(
            "font-mk-sans text-mk-body-sm font-mk-strong text-mk-ink",
            "transition-opacity duration-[var(--mk-dur-tap)] ease-[var(--mk-ease)]",
            on ? "opacity-100" : "opacity-70",
          )}
        >
          {step.label}
        </span>
      </button>
    </li>
  );
}

/* ── the objects ─────────────────────────────────────────────────────────────── */

/**
 * The phone. A CSS box, and the only drawn thing in the diagram.
 *
 * ⚠ `inert` and `aria-hidden` from the outside in. The label beside it already says what it
 * is, and a screen reader walking the real `<CardPage>` inside would read an entire second
 * copy of the card out of a diagram — `<CardPage>` renders real anchors and buttons, which is
 * also why `inert` is not optional. `card-studio.tsx` marks its cropped page frame both ways
 * for the same reason.
 *
 * ⚠ Selection is a LIFT, not a ground change. Tinting the cell behind the phone put a stray
 * rectangle of darker green on the wash, which is the "glitchy" the client named.
 */
function Device({ lit, children }: { lit: boolean; children: ReactNode }) {
  return (
    <span
      data-flow-device=""
      inert
      aria-hidden="true"
      className={mkcn(
        "relative block shrink-0 overflow-hidden bg-mk-ink",
        "transition-transform duration-[var(--mk-dur-lift)] ease-[var(--mk-ease)]",
        lit ? "-translate-y-1" : "translate-y-0",
      )}
      style={{
        width: `${DEVICE_W}px`,
        height: `${DEVICE_H}px`,
        padding: `${BEZEL}px`,
        borderRadius: "26px",
        /* The pass's own shadows, from `marketing.css`. This file declares none: the source
           rule in `marketing.spec.ts` fails any component here that ships its own. */
        boxShadow: lit ? "var(--mk-shadow-float)" : "var(--mk-shadow-card)",
      }}
    >
      {/* ⚠ The screen carries no ground of its own — each screen sets one. The wallet is an
          app surface (paper) and the card page paints its own palette edge to edge; a single
          white here made the wallet read as a blank sheet rather than as a screen. */}
      <span
        className="relative block overflow-hidden"
        style={{ width: `${SCREEN_W}px`, height: `${SCREEN_H}px`, borderRadius: "19px" }}
      >
        {children}
      </span>
    </span>
  );
}

/**
 * The pass, in the wallet.
 *
 * ⚠ The card behind it is a plain Onyx box and not a second `<ShareFace>`. Wallet passes stack
 * — `share-face.tsx` says so where the format is defined — and the stack is what makes this
 * read as a wallet rather than a card floating on a white screen. A second real card would be
 * the ninth card render on a page whose whole correction was that cards had become wallpaper,
 * and `marketing.spec.ts` fails on exactly that.
 */
function WalletScreen({ resolved }: { resolved: ResolvedCard }) {
  return (
    <span
      className="flex h-full w-full flex-col items-center justify-start bg-mk-paper"
      style={{ paddingTop: `${PASS_TOP}px` }}
    >
      <span
        className="block rounded-t-[9px] bg-mk-ink/12"
        style={{ width: `${PASS_W - 20}px`, height: "18px" }}
      />
      <ShareFace resolved={resolved} mode="thumb" thumbWidth={PASS_W} />
    </span>
  );
}

/**
 * The page the scan opens.
 *
 * Rendered at a real phone width and scaled, never re-laid-out at the screen's width:
 * `<CardPage>` is fluid, so laying it out at 160px would produce a different page from the one
 * a phone gets and the diagram would show a layout that does not exist. Scaling the real one is
 * the trick `<ShareFace mode="thumb">` already uses.
 *
 * `.mk-fade-b` crops the foot so it reads as "continues below" rather than as a row cut in
 * half. Its gradient lives in `marketing.css` — no component in this directory may declare one.
 */
function CardScreen({ resolved }: { resolved: ResolvedCard }) {
  return (
    <span
      className="mk-fade-b block h-full w-full overflow-hidden bg-mk-white"
      style={{ "--mk-fade-to": "var(--mk-white)" } as CSSProperties}
    >
      <span
        className="block origin-top-left"
        style={{ width: `${PAGE_NATURAL_W}px`, transform: `scale(${SCREEN_W / PAGE_NATURAL_W})` }}
      >
        <CardPage resolved={resolved} />
      </span>
    </span>
  );
}

/* ── the connectors ──────────────────────────────────────────────────────────── */

/**
 * The scan arrow.
 *
 * ⚠ Drawn, never a glyph. `marketing.spec.ts` fails any component here that ships a character
 * from the arrows block, and the rule is right: a glyph inherits the text's weight and optical
 * centre, so it never lands on the rule it is supposed to terminate.
 *
 * ⚠ The wrapper reserves the ROTATED footprint. A rotate is a transform and a transform does
 * not change the layout box, so turning a 96×24 arrow for the mobile column gave a 24×96
 * visual inside a 24px-tall box — 36px of overhang at each end, drawn straight through the
 * label above it. The two axes swap; nothing overhangs at either breakpoint.
 *
 * ⚠ The draw starts FINISHED. `stroke-dashoffset: 0` is set inline, so with no JavaScript,
 * with the e2e harness's durations zeroed, and under reduced motion the arrow is complete.
 * Becoming current replays the draw via one keyframe in `marketing.css`. An arrow that grew
 * from nothing on intersection would be an arrow that is *missing* for a reader whose script
 * failed, which is the failure `mk-motion.tsx`'s first rule exists to stop.
 */
function Arrow({ lit }: { lit: boolean }) {
  return (
    <span className="flex shrink-0 items-center justify-center sm:w-full">
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 120 24"
        className={mkcn(
          "h-6 w-[6rem] shrink-0 rotate-90 transition-opacity sm:w-full sm:rotate-0",
          "duration-[var(--mk-dur-tap)] ease-[var(--mk-ease)]",
          /* ⚠ 45% was the rejected build's resting arrow and it read as a smudge on the wash.
             A connector is structure, not decoration: it holds at 70% and lifts to full. */
          lit ? "opacity-100" : "opacity-70",
        )}
        style={{ color: "var(--mk-ink)" }}
      >
        <line
          data-flow-arrow-shaft={lit ? "lit" : "rest"}
          x1="2"
          y1="12"
          x2="104"
          y2="12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          /* The shaft's own length. `mk-flow-draw` in `marketing.css` uses the same 102. */
          strokeDasharray="102"
          strokeDashoffset="0"
        />
        <path
          d="M104 6.5 L112.5 12 L104 17.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * **The return: the card can change after you have handed it over.**
 *
 * ## ⚠ IT IS A CSS BRACKET RATHER THAN AN SVG PATH, AND THAT IS ROBUSTNESS
 * A drawn path from the card back to the pass needs both objects' positions, which move at
 * every breakpoint and again whenever a label wraps. Every version of that is either a
 * `ResizeObserver` recomputing coordinates or hand-tuned viewBoxes that break on the first
 * viewport nobody tested. A box with an open top is the same drawing, reflows for free, and is
 * correct at every width by construction.
 *
 * ## ⚠ IT IS NOT DESKTOP-ONLY, AND IT WAS
 * The first build hung it on `hidden lg:block`, so **every phone reader got the hand-over and
 * none of them got the loop** — the three steps any competitor could also draw, and not the
 * one that is the reason the product exists. Below `sm` the bracket becomes a rule down the
 * left with the arrowhead at its top, pointing back up the column the reader just scrolled.
 * Same statement, one axis rotated, which is what the scan arrow already does.
 */
function ReturnPath({
  label,
  active,
  onPick,
}: {
  label: string;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <div className="relative mt-2">
      <div
        aria-hidden="true"
        className={mkcn(
          "pointer-events-none absolute border-l transition-colors",
          "duration-[var(--mk-dur-tap)] ease-[var(--mk-ease)]",
          /* below sm: a rule down the left of the block. */
          "inset-y-0 left-2",
          /* sm and up: a bracket under the rail, generously rounded so it reads as a path
             turning rather than as a wireframe box. */
          "sm:inset-y-auto sm:top-0 sm:right-2 sm:h-12 sm:w-auto sm:rounded-b-[20px]",
          "sm:border-x sm:border-b",
          active ? "border-mk-ink" : "border-mk-ink/40",
        )}
      />

      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 14"
        className={mkcn(
          "absolute left-2 top-0 h-3 w-5 -translate-x-1/2 -translate-y-1/2 transition-opacity",
          "duration-[var(--mk-dur-tap)] ease-[var(--mk-ease)]",
          active ? "opacity-100" : "opacity-70",
        )}
        style={{ color: "var(--mk-ink)" }}
      >
        <path
          d="M5.5 10 L12 3 L18.5 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* The label rides the bracket's bottom edge, masking it with the pass's own ground so
          the line appears to pass behind the words. Below `sm` it is an ordinary line inside
          the rule. */}
      <button
        type="button"
        data-flow-loop=""
        aria-current={active ? "step" : undefined}
        onClick={onPick}
        onFocus={onPick}
        onMouseEnter={onPick}
        className={mkcn(
          "ml-8 cursor-pointer rounded-mk-pill py-1 text-left",
          "font-mk-sans text-mk-body-sm font-mk-strong text-mk-ink",
          "transition-opacity duration-[var(--mk-dur-tap)] ease-[var(--mk-ease)]",
          active ? "opacity-100" : "opacity-70",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-ink",
          "sm:absolute sm:left-1/2 sm:top-12 sm:ml-0 sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:bg-mk-pistachio sm:px-4",
        )}
      >
        {label}
      </button>

      {/* Clears the chip, which overhangs the bracket by half its own height. */}
      <div aria-hidden="true" className="hidden sm:block sm:h-16" />
    </div>
  );
}

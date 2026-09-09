"use client";

import { useState } from "react";

import { paletteGroundImage, TEMPLATE_PALETTES, type PaletteId } from "@/card/template-palettes";
import { solution, type ProfileField, type SolutionCard } from "@/fixtures/marketing";

import { mkcn } from "./mk-cn";
import { Section } from "./section";
import { accented, HEAD_TO_BODY, Prose, SectionHead } from "./type";

/**
 * Section 3 — the solution. Brief Section 3, and the section that carries the product idea.
 *
 * ## It absorbed two whole sections, and neither argument was dropped
 *   · `trust` ("A card is a filter, not a copy.") *was* the brief's Solution section, sitting
 *     three screens too low under a different name. Its four prose panels are now the exhibit
 *     below, because a reader can press a claim and check it but can only take a panel on
 *     trust.
 *   · `broadcast` ("No app can change your number inside someone else's phone.") was the best
 *     writing on the old page and structurally in the wrong place — a rebuttal delivered before
 *     the claim, so a visitor met the caveat before they knew what the product did. It is the
 *     last paragraph here, answering a question the reader has just formed.
 *
 * ## The exhibit is the argument, not an illustration of it
 * Profile on the left, three cards on the right. Press a card and the profile dims to the
 * fields that card carries. "A card is a filter over your profile, not a second copy of it" is
 * a sentence you have to be taken at your word for; the same claim as something a visitor can
 * operate is one they can verify in two seconds.
 *
 * ⚠ NO CONNECTOR LINES, AND THAT WAS A DELIBERATE SUBTRACTION. The first sketch drew SVG lines
 * from each profile row to the cards carrying it. Twelve rows against three cards is up to
 * thirty-six lines; at any width narrow enough to matter they cross into a mesh, and the
 * drawing has to be re-solved at every breakpoint. The dimming already says which fields
 * travel, in one property, at every width, with no geometry to maintain.
 *
 * ## ⚠ THE PRIVATE ROW IS THE POINT OF INCLUDING A PROFILE AT ALL
 * `bank` is marked private, appears on no card, and cannot be pressed onto one. That is a real
 * product rule — a private field is masked everywhere and cannot be added to a shared card at
 * all, not a warning you can click past — and it is the strongest thing this page can say
 * about control. Leaving it out would have made the claim invisible.
 *
 * ## Interaction rules
 * `null` is a real state, not "nothing selected yet": it means *everything you have added*, and
 * it is what the section renders on the server. Pressing the active card again returns to it.
 * A reader who never touches the exhibit still sees a complete, meaningful profile.
 */
/**
 * ⚠ THE FIXTURE IS READ THROUGH WIDENED ALIASES, AND THAT IS NOT CEREMONY.
 *
 * `as const satisfies` narrows every value to a literal type, which is what makes the fixtures
 * self-checking — but it also means `fields` is a tuple of exact strings (so
 * `fields.includes(id)` will not accept a `string`) and an omitted optional like `private` is
 * absent from that member's type entirely (so `field.private` is an error on eleven of twelve
 * rows). Widening once, here, keeps the narrowing where it earns its place — in the data — and
 * out of the component that only wants to read it.
 */
const PROFILE: readonly ProfileField[] = solution.profile;
const CARDS: readonly SolutionCard[] = solution.cards;

export function Solution() {
  const [active, setActive] = useState<string | null>(null);
  const card = CARDS.find((c) => c.id === active) ?? null;
  /** `null` → every field travels. A private field never does, whatever is selected. */
  const carries = (id: string) => (card ? card.fields.includes(id) : true);

  return (
    <Section id="solution" tone="white" labelledBy="solution-heading">
      <SectionHead
        heading={accented(solution.heading, solution.accent)}
        headingId="solution-heading"
        lead={solution.lead}
      />

      <div className="mt-5 space-y-4">
        {solution.paragraphs.map((paragraph) => (
          <Prose key={paragraph} className="max-w-mk-measure">
            {paragraph}
          </Prose>
        ))}
      </div>

      <div className={mkcn(HEAD_TO_BODY, "grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10")}>
        {/* ── the profile ────────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-7">
          <p className="text-mk-caption font-mk-medium text-mk-pebble uppercase tracking-[0.1em]">
            {solution.profileLabel}
          </p>

          <ul className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            {PROFILE.map((field) => {
              const shared = !field.private && carries(field.id);
              return (
                <li
                  key={field.id}
                  data-profile-field={field.id}
                  data-shared={shared ? "" : undefined}
                  className={mkcn(
                    "flex items-center justify-between gap-3 border-t border-mk-hairline py-2.5 text-mk-body-sm",
                    // ⚠ The dim level is `--mk-stone` (4.83:1), not an opacity. A field that is
                    // not on the selected card is still *in your profile* — it has to stay
                    // readable, because the claim being demonstrated is "this one is withheld",
                    // not "this one is gone". An opacity fade would make it decoration.
                    shared ? "text-mk-ink" : "text-mk-stone",
                  )}
                >
                  <span className="truncate">{field.label}</span>

                  {field.private ? (
                    <span className="shrink-0 rounded-mk-chrome bg-mk-oxblood/10 px-2 py-0.5 text-mk-caption font-mk-medium text-mk-oxblood">
                      {solution.privateTag}
                    </span>
                  ) : shared ? (
                    /* Drawn, never glyphed. `--mk-green-ink` at 4.51:1, because a 14px mark is
                       not large text even when it is a shape. */
                    <svg
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      fill="none"
                      aria-hidden="true"
                      className="shrink-0 text-mk-green-ink"
                    >
                      <path
                        d="M3 8.5 6.2 11.5 13 4.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    /* The slot is held whether or not a mark is drawn, so selecting a card
                       moves no row. */
                    <span aria-hidden="true" className="size-3.5 shrink-0" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── the cards ──────────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-5">
          <p className="text-mk-caption font-mk-medium text-mk-pebble uppercase tracking-[0.1em]">
            {solution.cardsLabel}
          </p>

          <div className="mt-4 space-y-3">
            {CARDS.map((entry) => {
              const palette = TEMPLATE_PALETTES[entry.paletteId as PaletteId];
              const on = active === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  data-solution-card={entry.id}
                  aria-pressed={on}
                  /* Pressing the active card returns to the whole profile, so the exhibit can
                     always be put back and never traps a reader in a filtered view. */
                  onClick={() => setActive(on ? null : entry.id)}
                  className={mkcn(
                    "block w-full rounded-mk-row p-5 text-left",
                    "transition-[box-shadow] duration-[var(--mk-dur-lift)] ease-[var(--mk-ease)]",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-ink",
                    // ⚠ THE SELECTED CARD IS RINGED. THE OTHERS ARE NOT DIMMED, AND THE FIRST
                    // CUT OF THIS HAD IT BACKWARDS.
                    //
                    // Unselected cards were set to `opacity-55`, which on white turns Onyx into
                    // a mid grey and Clay into a wash — the two deep grounds stop being
                    // themselves, on the one page whose whole argument about cards is that the
                    // colours are chosen and measured. It also said the wrong thing: an
                    // unselected card is not a lesser card, it is simply not the one being
                    // shown.
                    //
                    // The dimming already happens on the PROFILE side, which is where the
                    // demonstration lives. Doing it on both sides was redundant and cost the
                    // palette. A ring marks the selection, costs no colour, and animates a
                    // shadow rather than an opacity so the card's own ground never changes.
                    on ? "ring-2 ring-mk-ink ring-offset-2" : "ring-0",
                  )}
                  style={{ backgroundImage: paletteGroundImage(palette), color: palette.ink }}
                >
                  <span className="block font-mk-display text-mk-heading-sm font-mk-editorial">
                    {entry.name}
                  </span>
                  <span className="mt-1 block text-mk-body-sm" style={{ color: palette.inkSoft }}>
                    {entry.note}
                  </span>
                  <span
                    className="mt-3 block text-mk-caption font-mk-medium"
                    style={{ color: palette.inkSoft }}
                  >
                    {entry.fields.length} of {PROFILE.length} fields
                  </span>
                </button>
              );
            })}
          </div>

          <p aria-live="polite" className="mt-4 text-mk-caption text-mk-pebble">
            {card ? `Showing what the ${card.name} card carries.` : solution.allLabel}
          </p>
        </div>
      </div>

      {/* ── the honesty paragraph. See the fixture: it may not be cut. ─────────────────── */}
      <div className="mt-14 max-w-mk-measure border-t border-mk-hairline pt-6 md:mt-16">
        <p className="font-mk-display text-mk-heading-sm font-mk-editorial text-mk-ink">
          {solution.honesty.term}
        </p>
        <Prose className="mt-3">{solution.honesty.detail}</Prose>
      </div>
    </Section>
  );
}

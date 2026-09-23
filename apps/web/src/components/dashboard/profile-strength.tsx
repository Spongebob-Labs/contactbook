import Link from "next/link";
import type { ReactElement } from "react";

/**
 * How much of the owner's profile is actually carrying something, drawn as a ratio the data can
 * defend.
 *
 * ## Why this replaced "Most recent card"
 *
 * The slot above this one used to hold a thumbnail of the card the owner touched last. A picture
 * of a card the owner just built answers no question — they know what it looks like, they were
 * there — and it was the second largest object on the screen. The client asked for the space to
 * go to something relevant and interactive instead.
 *
 * The profile is the right tenant for it. Every card is a *subset* of the profile, so the profile
 * is the one upstream thing on this screen: a group with nothing in it is a detail that no card
 * can offer, however many cards exist. Nothing else on the dashboard reports on it.
 *
 * ## ⚠ There is no percentage here, and that is the whole design
 *
 * The obvious tile is "your profile is 62% complete". It is unbuildable. A percentage needs a
 * denominator, and **there is no defined maximum number of profile fields** — a profile with six
 * fields is not 60% of a profile with ten, it is a different profile. Any such figure would be a
 * number this product invented and then asked the owner to believe, which is exactly the defect
 * `src/lib/dashboard/metrics.ts` opens by warning about ("a wrong one is invisible — a count that
 * is quietly off ... reads exactly like a correct one").
 *
 * So the ratio is **groups that carry at least one field, over groups that exist**. Both sides
 * are counted from data the caller already holds, the denominator is the owner's own structure
 * rather than a target someone picked, and the shortfall is not an abstraction: each missing
 * group has a name, and "Work is empty" is a sentence the owner can act on in one tap.
 *
 * `fieldCount` is reported beside the heading as a plain total and **never as a numerator**. It
 * is context ("there are 12 fields in here"), and the moment it acquires a denominator it becomes
 * the invented figure this component exists to avoid.
 *
 * ## Why every empty group links to `/profile` and not to `/profile/groups/[groupId]`
 *
 * The per-group editor would be the tighter target, and it would 404 for a subset of these rows.
 * Not every section of the profile screen corresponds to a group upstream: `map.ts` invents
 * synthetic sections to hold ungrouped `PERSONAL` / `IDENTITY` / `CUSTOM` fields, and
 * `profile-client.tsx` already carries the note that "sending its id as a real `groupId` would
 * 404". A summary row cannot tell a real group from a synthetic one — `ProfileGroupSummary` is
 * just an id, a name and a count — so the deep link is right for most rows and a dead end for the
 * rest. `/profile` is correct for all of them, and a dashboard that sometimes throws the owner
 * onto a not-found page is worse than one that costs them a scroll.
 *
 * ## Why the meter always has a word next to it
 *
 * `PRODUCT.md`: status is never carried by colour alone. A filled track is a second encoding, and
 * it is the *weakest* one exactly where it matters most — at zero filled groups the fill has no
 * width at all, so a meter alone renders the "not started" state and a failed render identically.
 * The word is the first encoding and survives greyscale, monochrome and every form of colour
 * blindness; the track is decoration over it and is `aria-hidden` for that reason, since the
 * ratio is already stated in words directly above.
 *
 * ## ⚠ No `--dash-*` token is referenced here
 *
 * The dashboard has no palette of its own. The mint family that used to be scoped to this screen
 * was deleted at the client's instruction, and `tokens.css` carries the epitaph and the ladder
 * that replaced it; this tile is built on that ladder and nothing else:
 *
 *   track, all-clear well `--surface-sunk`   1.14 on `--canvas`
 *   meter fill            `--accent`         16.67 on `--canvas`
 *   heading, captions     `--ink-3`          5.20 on `--canvas`
 *   state word, sentences `--ink-2`          10.98 on `--canvas`
 *   panel hairline        `--line`           decorative, held to "visible"
 *
 * Green is absent by decision, not by omission — including as a "complete" colour, which is the
 * one place a component like this reaches for it by reflex. The finished state is carried by the
 * word "Complete" and a full track, which is what a reader in greyscale gets anyway.
 */

export interface ProfileGroupSummary {
  id: string;
  name: string;
  fieldCount: number;
}

export interface ProfileStrengthProps {
  /**
   * Total profile fields the owner has — `null` when the dashboard API did not send a usable
   * count (see `readDashboardTotals`). The line is then left out, never printed as 0.
   */
  fieldCount: number | null;
  /** Every group on the profile, including empty ones. */
  groups: readonly ProfileGroupSummary[];
}

/**
 * The four states, named rather than derived at each call site.
 *
 * `no-groups` is deliberately distinct from `not-started`: an account with no groups at all has
 * not scored zero, it has not played, and the copy each one earns is different — one is an
 * invitation, the other is a list of names. Collapsing them would render a brand-new owner an
 * empty meter with nothing to press.
 */
type Standing = "no-groups" | "not-started" | "in-progress" | "complete";

/**
 * The meter's state in words. Short enough to sit on one line beside the track at 360px, and
 * distinct enough that the four read differently when the colour is gone.
 */
const WORD: Record<Standing, string> = {
  "no-groups": "Empty",
  "not-started": "Not started",
  "in-progress": "In progress",
  complete: "Complete",
};

export function ProfileStrength({ fieldCount, groups }: ProfileStrengthProps): ReactElement {
  const total = groups.length;
  const empty = groups.filter((group) => group.fieldCount === 0);
  const filled = total - empty.length;

  const standing: Standing =
    total === 0
      ? "no-groups"
      : filled === 0
        ? "not-started"
        : filled === total
          ? "complete"
          : "in-progress";

  /**
   * ⚠ `total === 0` is checked before the division, not after. `0 / 0` is `NaN`, and `NaN` in a
   * `width` is not an error anywhere — React writes `width: NaN%`, the browser drops the
   * declaration, and the meter silently renders as an empty track that looks exactly like the
   * legitimate zero state. A brand-new account is the most common way this component is first
   * seen, so the one arithmetic edge it has is the one every new owner would hit.
   *
   * The `Math.max(2, …)` floor is for the opposite end: a group ratio that rounds to 0% while
   * `filled > 0` would draw nothing and contradict the sentence above it. Two percent is a stub,
   * not a measurement, and the true figure is stated in words regardless.
   */
  const percent =
    total === 0 || filled === 0 ? 0 : Math.max(2, Math.round((filled / total) * 100));

  return (
    <section data-profile-strength="" aria-labelledby="profile-strength-heading">
      {/* The field total sits beside the heading rather than inside it, for the same reason the
          attention list keeps its count out of its own heading: a landmark's accessible name is
          read on every jump, and a name that changes whenever the owner adds a field is a worse
          name than a fixed one. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="profile-strength-heading" className="text-overline uppercase text-ink-3">
          Profile strength
        </h2>
        {fieldCount === null ? null : (
          <p data-profile-strength-fields="" className="text-sm text-ink-3 tabular-nums">
            {fieldCount} {fieldCount === 1 ? "field" : "fields"} in all
          </p>
        )}
      </div>

      {/* The claim, in full, as one text node. It is deliberately a whole sentence rather than a
          big figure with a caption beside it: "3" alone invites the reader to supply their own
          denominator, which is the one reading this component must not permit. `tabular-nums`
          because the two numbers change under it on every load and should not shift the line. */}
      <p data-profile-strength-ratio="" className="mt-4 text-h3 text-ink tabular-nums">
        {total === 0
          ? "No groups yet"
          : `${filled} of ${total} ${total === 1 ? "group" : "groups"} filled`}
      </p>

      <div className="mt-3 flex items-center gap-3">
        {/* `aria-hidden`: this is the same number the sentence above already states, and a
            screen reader that hears "3 of 7 groups filled" followed by a progress bar reporting
            43 has been told one fact twice in two units.

            `overflow-hidden` on the track so the fill's own radius is clipped to the track's at
            small widths — without it a 2px stub renders as a lozenge wider than it is tall. */}
        <span
          aria-hidden="true"
          data-profile-strength-meter={standing}
          className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunk"
        >
          <span
            data-profile-strength-fill=""
            /* `--dur-base` rather than a literal: every duration token is zeroed centrally under
               `prefers-reduced-motion` in `globals.css` §3b, and a hard-coded `220ms` here would
               be the one animation on the dashboard that ignores the setting. No local
               reduced-motion block — §3b forbids a second one. */
            className="block h-full rounded-full bg-accent transition-[width] duration-[var(--dur-base)] ease-out"
            style={{ width: `${percent}%` }}
          />
        </span>

        {/* Not `aria-hidden`, and not inside the track: this is the state, and the fill beside it
            is the decoration. `shrink-0` so the word never truncates — a meter labelled "In
            prog…" has lost the encoding the label exists to carry. */}
        <span
          data-profile-strength-word=""
          className="shrink-0 text-overline uppercase text-ink-2"
        >
          {WORD[standing]}
        </span>
      </div>

      {standing === "no-groups" ? (
        <>
          {/* An owner with no groups is invited, not graded. There is nothing to name and nothing
              to nag about, so the copy says what a group is for and hands them the one door. */}
          <p data-profile-strength-none="" className="mt-5 text-sm text-ink-2">
            No groups yet. Groups are how the profile is organised, and every card you build draws
            from them.
          </p>
          <ProfileLink />
        </>
      ) : standing === "complete" ? (
        /* ⚠ The finished state congratulates and then stops. The obvious next move — "add another
           group to get further" — would make the meter unwinnable by construction, since the
           denominator is the owner's own structure and inviting them to grow it guarantees the
           tile is never full. A dashboard that cannot be satisfied is a dashboard people learn to
           ignore. The panel is a statement, not an absence, for the same reason the attention
           list draws its all-clear: an empty region reads as a component that failed to load. */
        <>
          <p
            data-profile-strength-clear=""
            /* `bg-surface-sunk` + `border-line`, matching the attention list's all-clear panel
               exactly. The two healthy states appear on the same screen at the same moment, and
               an owner with nothing to do should see one treatment saying so, not two. */
            className="mt-5 rounded-lg border border-line bg-surface-sunk px-4 py-3 text-sm text-ink-2"
          >
            Every group has something in it. Nothing here is waiting on you.
          </p>
          <ProfileLink />
        </>
      ) : (
        <>
          <p className="mt-5 text-sm text-ink-2">
            Every card filters this profile, so a group with nothing in it is a detail no card can
            offer.
          </p>

          {/* Each name is its own link, which is why there is no second `ProfileLink` below this
              branch: the rows already go where the trailing link would, and two routes to one
              destination on a tile this size is noise. The name is the target because the name is
              what the owner is deciding about. */}
          <ul data-profile-strength-empty="" className="mt-3 flex flex-col gap-2">
            {empty.map((group) => (
              <li
                key={group.id}
                data-profile-strength-empty-group={group.id}
                className="flex min-w-0 items-baseline gap-1"
              >
                {/* `min-w-0` + `truncate` + `title`, the same trio the attention list runs on:
                    without `min-w-0` a flex child refuses to shrink below its own content, so a
                    40-character group name pushes "is empty" off the right edge at 360px instead
                    of ellipsing, and `title` is what keeps the full name reachable once it
                    does. */}
                <Link
                  href="/profile"
                  title={group.name}
                  className="min-w-0 truncate text-sm text-ink underline-offset-4 hover:underline"
                >
                  {group.name}
                </Link>
                <span className="shrink-0 text-sm text-ink-3">is empty</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** The one door, for the two states that have no named rows to carry it. */
function ProfileLink(): ReactElement {
  return (
    <Link
      href="/profile"
      data-profile-strength-action=""
      className="mt-5 inline-block text-sm text-ink underline underline-offset-4"
    >
      Open your profile
    </Link>
  );
}

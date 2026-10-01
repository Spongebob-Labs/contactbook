import Link from "next/link";
import type { ReactElement } from "react";
import { ArrowRight, Check } from "lucide-react";

import { Avatar } from "@/components/primitives/avatar";
import { formatEmailDisplay, formatPhoneDisplay } from "@/lib/format";
import type { ProfileField } from "@/types/domain";

import type { ProfileCompleteness } from "./profile-completeness";
import { SummaryTile } from "./summary-tile";

/**
 * The Profile tile: who the owner is, and what their profile is missing.
 *
 * It replaced two things. The dashboard showed no profile summary at all, which the client
 * called incomplete, and a separate "Profile strength" block counted groups with something in
 * them. That ratio could say "7 of 7 groups filled" about a profile with no photo and no job
 * title. The completeness here is measured against a named key set instead (see
 * `profile-completeness.ts`), so every missing item is something the owner can add in one step.
 *
 * At most two missing items are offered. A list of six reads as a form to fill in, and the
 * point is the next step, not the whole backlog; the count beside the meter still says how many
 * are left.
 */

/** How many missing items are offered as actions. */
export const PROFILE_SUGGESTION_LIMIT = 2;

/**
 * "Head of Partnerships · Fernwood Studio" — the first job title and the first company on the
 * profile, whichever exist. For display only; nothing here is logged.
 */
export function roleLine(
  fields: readonly Pick<ProfileField, "type" | "value">[],
): string | null {
  const first = (type: ProfileField["type"]) =>
    fields.find((field) => field.type === type && field.value.trim().length > 0)?.value.trim();
  const parts = [first("JOB_TITLE"), first("COMPANY")].filter(
    (part): part is string => part !== undefined,
  );
  return parts.length === 0 ? null : parts.join(" · ");
}

export interface ProfileTileProps {
  firstName: string;
  lastName: string;
  /** "Head of Partnerships · Fernwood Studio", or `null` when the profile has neither. */
  role: string | null;
  phone: string;
  email: string | null;
  photoUrl: string | null;
  completeness: ProfileCompleteness;
}

export function ProfileTile({
  firstName,
  lastName,
  role,
  phone,
  email,
  photoUrl,
  completeness,
}: ProfileTileProps): ReactElement {
  const fullName = `${firstName} ${lastName}`.trim();
  const phoneShown = phone.trim().length > 0 ? formatPhoneDisplay(phone) : null;
  /* A user exists from the moment their phone is verified, before they give a name. The number
     is the honest heading then, and it is not repeated underneath. */
  const heading = fullName.length > 0 ? fullName : (phoneShown ?? "");
  const suggestions = completeness.missing.slice(0, PROFILE_SUGGESTION_LIMIT);
  const complete = completeness.missing.length === 0;
  const percent =
    completeness.total === 0 ? 0 : Math.round((completeness.done / completeness.total) * 100);

  return (
    <SummaryTile
      region="profile"
      title="Profile"
      link={{ label: "Edit", href: "/profile", ariaLabel: "Edit profile" }}
      footer={
        suggestions.length === 0 ? undefined : (
          <ul data-profile-suggestions="" className="-mx-2 flex flex-col">
            {suggestions.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  data-profile-suggestion={item.id}
                  className="group flex min-h-11 items-center justify-between gap-3 rounded-md px-2 text-sm text-ink transition-colors duration-[var(--dur-fast)] hover:bg-surface-sunk"
                >
                  {item.action}
                  <ArrowRight
                    size={15}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )
      }
    >
      {/* ⚠ Stacked from 1024 to 1399px. The tile is 226–352px wide there (three across,
          beside the 248px rail), and a 64px avatar beside the text left the name 106–192px,
          which cut "Priyanka Raghunathan" to "Priyanka …". The avatar goes on top instead and
          the text gets the tile's full width. 1400 is the same step the Cards tile's
          thumbnail table uses. */}
      <div className="flex min-w-0 items-start gap-4 lg:max-[1399px]:flex-col lg:max-[1399px]:gap-3">
        {/* Hidden from the accessibility tree: the name is stated in text right beside it, and a
            nameless owner would otherwise leave an `img` with an empty label. */}
        <span aria-hidden="true" className="shrink-0">
          <Avatar name={fullName} src={photoUrl} size="lg" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p data-profile-name="" title={heading} className="line-clamp-2 break-words text-h3 text-ink">
            {heading}
          </p>
          {role === null ? null : (
            <p data-profile-role="" title={role} className="line-clamp-2 text-sm text-ink-2">
              {role}
            </p>
          )}
          {phoneShown !== null && fullName.length > 0 ? (
            <p data-profile-phone="" className="mt-1.5 truncate text-sm tabular-nums text-ink-3">
              {phoneShown}
            </p>
          ) : null}
          {email !== null && email.trim().length > 0 ? (
            /* Wraps rather than truncating: a cut email loses its domain, which is the half
               that tells two addresses apart. */
            <p data-profile-email="" className="text-sm text-ink-3 [overflow-wrap:anywhere]">
              {formatEmailDisplay(email)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* `aria-hidden`: the fraction beside it states the same figure in words. */}
        <span
          aria-hidden="true"
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunk"
        >
          <span
            data-profile-meter-fill=""
            className="block h-full rounded-full bg-accent transition-[width] duration-[var(--dur-base)] ease-out"
            style={{ width: `${percent}%` }}
          />
        </span>
        <span
          data-profile-completeness={`${completeness.done}/${completeness.total}`}
          className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-ink-2"
        >
          {complete ? (
            <Check size={13} strokeWidth={2} aria-hidden="true" className="text-ink-2" />
          ) : null}
          {`${completeness.done} of ${completeness.total}`}
          <span className="sr-only"> profile details added</span>
        </span>
      </div>
    </SummaryTile>
  );
}

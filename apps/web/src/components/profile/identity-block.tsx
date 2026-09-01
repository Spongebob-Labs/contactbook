"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Avatar } from "@/components/primitives/avatar";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/input";
import { formatPhoneDisplay } from "@/lib/format";
import type { User } from "@/types/domain";

/**
 * The identity block that opens `/profile` — spec §8D.3, §5.5 (`User` · update).
 *
 * ## What is editable here, and what deliberately is not
 * §5.5's lifecycle table gives `User` exactly one update surface — this block — so first
 * name, last name and email are editable. **Phone is not.** It is the credential the auth
 * flow is built on (§8D.2 A-1), and changing a sign-in identifier is a verification flow,
 * not a text input; offering one that silently did nothing would be the worst of both.
 * It renders as read-only with the reason stated.
 *
 * ## The avatar is derived, never stored here
 * §5.3a: the avatar resolves from the mapped `PHOTO` field, then `User.avatarUrl`, then a
 * monogram. T05's `Avatar` already implements that last step — a `null` or 404 source
 * lands on initials in the same 80px box (E-19, E-20), never a broken-image glyph and
 * never an empty circle. So this block passes the URL straight through and does not
 * branch on it.
 *
 * ## Nothing is saved
 * The patch goes to the screen's `useReducer` and dies on reload (§5.7, §3.1).
 */

export interface IdentityPatch {
  firstName: string;
  lastName: string;
  email: string | null;
}

export interface IdentityBlockProps {
  user: User;
  /** Fields across every group, after local edits — the "what is on your cards" number. */
  fieldCount: number;
  groupCount: number;
  /**
   * Omit to render the block read-only.
   *
   * Against the live API it *is* omitted, because there is no endpoint to change a name or an
   * email: `POST /profile/onboarding` sets them once and is one-shot, and the profile surface
   * has no identity PATCH. See `docs/INTEGRATION.md` ask #6.
   */
  onSave?: (patch: IdentityPatch) => void;
  /** Shown in place of the edit button when `onSave` is omitted. */
  readOnlyReason?: string;
  /**
   * Upload or replace the profile photo. Omit to hide the control.
   *
   * The API accepts JPEG, PNG or WebP up to 20 MB and enforces both itself
   * (`PHOTO_TYPE_UNSUPPORTED` 415, `PHOTO_TOO_LARGE` 413), so nothing is validated here beyond
   * "a file was chosen" — a second size limit in the client is a second number to keep in sync.
   */
  onUploadPhoto?: (file: File) => void;
  /** Remove the photo. Omit to hide the control; also hidden when there is no photo. */
  onRemovePhoto?: () => void;
  /** True while either photo action is in flight. */
  photoBusy?: boolean;
}

export function IdentityBlock({
  user,
  fieldCount,
  groupCount,
  onSave,
  readOnlyReason,
  onUploadPhoto,
  onRemovePhoto,
  photoBusy = false,
}: IdentityBlockProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  // Never true when `onSave` is absent: `startEditing` is only reachable from a button that is
  // not rendered in that case.
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);

  const fullName = `${user.firstName} ${user.lastName}`.trim();

  useEffect(() => {
    if (editing) firstNameRef.current?.focus();
  }, [editing]);

  function startEditing() {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email ?? "");
    setError(null);
    setEditing(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const first = firstName.trim();
    const last = lastName.trim();
    if (first.length === 0 || last.length === 0) {
      // The name is the one thing every card renders, whatever it maps (§5.3). A blank one
      // produces the name-only card with no name at all.
      setError("A first and last name are both needed — every card renders them.");
      return;
    }
    const trimmedEmail = email.trim();
    onSave?.({
      firstName: first,
      lastName: last,
      email: trimmedEmail.length === 0 ? null : trimmedEmail,
    });
    setEditing(false);
  }

  return (
    <section
      data-profile-identity=""
      aria-label="Your identity"
      className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-start sm:gap-8"
    >
      <div className="flex shrink-0 flex-col items-center gap-3">
        <Avatar name={fullName} src={user.avatarUrl} size="xl" />

        {onUploadPhoto === undefined ? null : (
          <div className="flex flex-col items-center gap-1">
            {/* The real control is the input; the button drives it. A bare file input cannot be
                styled to match, and `sr-only` rather than `hidden` keeps it reachable by
                keyboard and announced by a screen reader. */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              data-identity-photo-input=""
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Reset first: choosing the same file twice must fire `change` both times, and
                // it will not if the input still holds the previous selection.
                event.target.value = "";
                if (file !== undefined) onUploadPhoto(file);
              }}
            />
            <Button
              variant="secondary"
              data-identity-photo-upload=""
              loading={photoBusy}
              loadingLabel="Uploading…"
              onClick={() => photoInputRef.current?.click()}
            >
              {user.avatarUrl === null ? "Add photo" : "Change photo"}
            </Button>

            {user.avatarUrl === null || onRemovePhoto === undefined ? null : (
              <Button
                variant="text-link"
                data-identity-photo-remove=""
                onClick={onRemovePhoto}
              >
                Remove photo
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            data-identity-form=""
            onSubmit={submit}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-4 sm:flex-row">
              <Input
                ref={firstNameRef}
                label="First name"
                autoComplete="given-name"
                value={firstName}
                error={error}
                onChange={(event) => setFirstName(event.target.value)}
                fieldClassName="min-w-0 flex-1"
              />
              <Input
                label="Last name"
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                fieldClassName="min-w-0 flex-1"
              />
            </div>

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              hint="Optional. Leave it blank and we will only use your number."
              onChange={(event) => setEmail(event.target.value)}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">Save</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            <h2 data-identity-name="" className="text-h2 text-ink">
              {fullName}
            </h2>

            <dl className="mt-4 flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <dt className="text-xs text-ink-3">Email</dt>
                <dd data-identity-email="" className="text-base text-ink">
                  {user.email ?? "No email yet"}
                </dd>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <dt className="text-xs text-ink-3">Number</dt>
                <dd data-identity-phone="" className="text-base text-ink">
                  {formatPhoneDisplay(user.phone)}
                </dd>
              </div>
            </dl>

            <p data-identity-summary="" className="mt-4 text-sm text-ink-3">
              {fieldCount} {fieldCount === 1 ? "field" : "fields"} across {groupCount}{" "}
              {groupCount === 1 ? "group" : "groups"}. Every card you build picks from these.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {onSave === undefined ? null : (
                <Button variant="secondary" data-identity-edit="" onClick={startEditing}>
                  Edit identity
                </Button>
              )}
              <span className="text-xs text-ink-3">
                {readOnlyReason ??
                  "Your number is how you sign in, so it is changed from the sign-in flow."}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

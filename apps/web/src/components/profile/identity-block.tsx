"use client";

import { useRef } from "react";

import { Avatar } from "@/components/primitives/avatar";
import { Button } from "@/components/primitives/button";
import { formatPhoneDisplay } from "@/lib/format";
import type { User } from "@/types/domain";

/**
 * The identity at the top of the `/profile` workspace: photo, name, number, email.
 *
 * ## What is editable here, and what is not
 *
 * The photo is (`POST /profile/photo`, `DELETE /profile/photo`). The name and email are not:
 * `POST /profile/onboarding` sets them once and there is no endpoint that changes them, so they
 * render as text rather than as rows that look pressable. The number never will be — it is the
 * OTP-verified sign-in identity, and changing it is a verification flow, not a text input.
 *
 * The avatar is derived: `Avatar` falls back to initials for a missing or broken URL, so the
 * block never shows an empty circle.
 */

export interface IdentityBlockProps {
  user: User;
  /**
   * Upload or replace the profile photo. Omit to hide the control.
   *
   * The API accepts JPEG, PNG or WebP up to 20 MB and enforces both itself, so nothing is
   * validated here beyond "a file was chosen".
   */
  onUploadPhoto?: (file: File) => void;
  /** Remove the photo. Omit to hide the control; also hidden when there is no photo. */
  onRemovePhoto?: () => void;
  /** True while either photo action is in flight. */
  photoBusy?: boolean;
}

export function IdentityBlock({
  user,
  onUploadPhoto,
  onRemovePhoto,
  photoBusy = false,
}: IdentityBlockProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fullName = `${user.firstName} ${user.lastName}`.trim();

  return (
    <section
      data-profile-identity=""
      aria-label="Your identity"
      className="flex items-center gap-4 sm:gap-5"
    >
      <Avatar name={fullName} src={user.avatarUrl} size="lg" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 data-identity-name="" className="truncate text-h3 text-ink">
          {fullName}
        </h2>
        <p data-identity-phone="" className="truncate text-sm text-ink-2">
          {formatPhoneDisplay(user.phone)}
        </p>
        <p data-identity-email="" className="truncate text-sm text-ink-3">
          {user.email ?? "No email"}
        </p>

        {onUploadPhoto === undefined ? null : (
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            {/* The real control is the input; the button drives it. `sr-only` rather than
                `hidden` keeps it reachable by keyboard and announced by a screen reader. */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              data-identity-photo-input=""
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Reset first: choosing the same file twice must fire `change` both times.
                event.target.value = "";
                if (file !== undefined) onUploadPhoto(file);
              }}
            />
            <Button
              variant="text-link"
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
                disabled={photoBusy}
                onClick={onRemovePhoto}
              >
                Remove photo
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

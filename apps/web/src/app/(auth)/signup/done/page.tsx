"use client";

import Link from "next/link";

import { AuthStepForm } from "@/components/auth/auth-step-form";
import { WELCOME_PATH } from "@/components/onboarding/welcome-steps";
import { buttonClassName } from "@/components/primitives";
import { AUTH_STEPS, useAuthFlow } from "@/lib/auth-flow-context";

/**
 * A-6 — the hand-off from signing up to the card (spec §8D.2, R-08; client feedback 2026-09-28).
 *
 * ## ⚠ It no longer ends at the dashboard
 * The client's note: first login "should walk through card creation, not drop straight to
 * dashboard". So the one action here goes to `/welcome`, where the card onboarding just made is
 * shown big and edited in place — photo, role and bio, colour. The dashboard is still one tap
 * away from there ("Skip setup"), which is the right distance for someone who wants to leave.
 *
 * ## Why this is still a screen, and not a redirect
 * Every step of this flow shows `STEP n OF 6`, counted from `AUTH_STEPS` in
 * `lib/auth-flow-context.tsx`. Skipping this screen would end the flow on "5 OF 6" with no sixth
 * step ever shown, which is a progress indicator lying about the flow it measures. This is step 6:
 * the account is made, and the next thing is the card.
 *
 * ## ⚠ The starter-card thumbnail is gone, and it was not decoration
 * It rendered `<AuthShowcase>`, which draws the FIRST FIXTURE CARD — somebody else's name and
 * number — captioned "This is your starter card". For a real signup that was a false statement
 * about a card they had never seen. Their actual card is one tap away, at full size, on
 * `/welcome`; a picture of a different one here only competed with it. (The shell's side panel
 * already stands down on this step, so nothing else takes its place.)
 *
 * It is the one screen with no question, so it is the one screen that is not a `<form>` — a form
 * wrapped around a link is a lie about what Enter does. The primary action is an anchor for the
 * same reason: it navigates, so it is a link, and it wears the button skin through
 * `buttonClassName` rather than nesting a `<button>` inside an `<a>`.
 */

const STEP = AUTH_STEPS[5];

export default function DonePage() {
  const { values } = useAuthFlow();
  const firstName = values.firstName.trim();

  return (
    <AuthStepForm
      step={STEP}
      question={firstName.length === 0 ? "Your card is ready." : `Your card is ready, ${firstName}.`}
      helper="Add a photo, a short bio and a colour."
      screenState="success"
      primary={
        <Link
          href={WELCOME_PATH}
          data-auth-primary=""
          className={buttonClassName({
            size: "lg",
            className: "w-full md:w-auto md:min-w-40",
          })}
        >
          Set up my card
        </Link>
      }
    />
  );
}

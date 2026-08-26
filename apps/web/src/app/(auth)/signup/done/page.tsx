"use client";

import Link from "next/link";

import { AuthShowcase } from "@/components/auth/auth-shell";
import { AuthStepForm } from "@/components/auth/auth-step-form";
import { buttonClassName } from "@/components/primitives";
import { AUTH_STEPS, useAuthFlow } from "@/lib/auth-flow-context";

/**
 * A-6 — the confirmation (spec §8D.2, R-08). Success only: nothing to validate, nothing to
 * fail, no `?state=` surface of its own.
 *
 * It is the one screen with no question, so it is the one screen that is not a `<form>` —
 * a form wrapped around a link is a lie about what Enter does. The primary action is an
 * anchor for the same reason: it navigates, so it is a link, and it wears the button skin
 * through `buttonClassName` rather than nesting a `<button>` inside an `<a>`.
 *
 * The card is the real `<ShareFace mode="thumb">` from the shell — §8D.2's "live thumb
 * of the starter card". The shell drops its own panel on this step (see `auth-shell.tsx`),
 * so exactly one card is on screen at 1280px, not two of the same one.
 *
 * ⚠ Nobody has been signed in by arriving here (§7.1). "Go to dashboard" is a link to a
 * route that renders with the fixture user because there is no guard anywhere in this run
 * (§7.2) — not because a session was created.
 */

const STEP = AUTH_STEPS[5];

export default function DonePage() {
  const { values } = useAuthFlow();
  const firstName = values.firstName.trim();

  return (
    <AuthStepForm
      step={STEP}
      question={firstName.length === 0 ? "You're all set." : `You're all set, ${firstName}.`}
      helper="Your first card is made and ready to edit. Change the template, pick the fields, share the QR."
      screenState="success"
      primary={
        <Link
          href="/dashboard"
          data-auth-primary=""
          className={buttonClassName({
            size: "lg",
            className: "w-full md:w-auto md:min-w-40",
          })}
        >
          Go to dashboard
        </Link>
      }
    >
      <AuthShowcase caption="This is your starter card. Every field on it comes from your profile, and you decide which ones." />
    </AuthStepForm>
  );
}

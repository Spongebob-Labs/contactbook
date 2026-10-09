"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  AuthStepForm,
  useAutoFocus,
  useStepAnswer,
} from "@/components/auth/auth-step-form";
import { Input } from "@/components/primitives";
import { submitOnboarding } from "@/lib/auth-flow-api";
import { AUTH_STEPS, useAuthFlow } from "@/lib/auth-flow-context";
import { MAX_EMAIL_LENGTH, validateEmail } from "@/lib/auth-validation";

/**
 * A-5 — "What's your email?" (spec §8D.2, R-07). Was "Where can we reach you?" until the client's
 * 2026-10-09 wording.
 *
 * ## This is the screen that submits the profile
 * It is the last *question* of the flow, so it is where all three answers — first name, last
 * name, email — go to `POST /profile/onboarding` in a single call. The confirmation screen
 * after it submits nothing.
 *
 * Onboarding fires here rather than on the confirmation screen for two reasons. It is
 * **one-shot** — a second call is a 409 — so it has to happen at a point the user cannot
 * re-enter by pressing Back, and the confirmation screen is reachable by Back. And if it
 * fails, this screen can put the reason under the field it belongs to; a confirmation screen
 * that submits on mount and then apologises is strictly worse.
 *
 * ## "Skip for now" is gone, and that was not a style choice
 * `CompleteOnboardingDto.identity.primaryEmail` is **required**. Combined with one-shot
 * onboarding, a skipped email would be unfixable through this endpoint — the user would own a
 * profile the API considers complete and has no address for. The helper text now says the field
 * is needed instead of offering a way out that could not be honoured.
 */

const STEP = AUTH_STEPS[4];

export default function EmailPage() {
  const router = useRouter();
  const { values } = useAuthFlow();
  const inputRef = useAutoFocus<HTMLInputElement>();

  const { value, setValue, error, submit, screenState, pending } = useStepAnswer({
    step: STEP,
    field: "email",
    validate: validateEmail,
    focusRef: inputRef,
    action: (email) =>
      submitOnboarding({
        firstName: values.firstName,
        lastName: values.lastName,
        email,
      }),
  });

  // The names live in memory, so a reload on this step arrives with nothing to submit. Rather
  // than letting the action fail on a field this screen does not even show, send them back to
  // the question that was lost (§5.7).
  const namesMissing = values.firstName.trim().length === 0 || values.lastName.trim().length === 0;
  useEffect(() => {
    if (namesMissing) router.replace("/signup/first-name");
  }, [namesMissing, router]);

  return (
    <AuthStepForm
      step={STEP}
      question="What's your email?"
      helper="Used for sign-in and help desk, and added to a card if you choose."
      screenState={screenState}
      onSubmit={submit}
      submitLabel="Continue"
      submitPending={pending}
      submitPendingLabel="Saving…"
    >
      <Input
        ref={inputRef}
        label="Email address"
        hideLabel
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={MAX_EMAIL_LENGTH}
        placeholder="you@example.com"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={error}
      />
    </AuthStepForm>
  );
}

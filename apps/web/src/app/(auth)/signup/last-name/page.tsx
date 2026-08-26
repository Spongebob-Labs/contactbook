"use client";

import {
  AuthStepForm,
  useAutoFocus,
  useStepAnswer,
} from "@/components/auth/auth-step-form";
import { Input } from "@/components/primitives";
import { AUTH_STEPS, useAuthFlow } from "@/lib/auth-flow-context";
import { MAX_NAME_LENGTH, validateLastName } from "@/lib/auth-validation";

/**
 * A-4 — "And your last name?" (spec §8D.2, R-06).
 *
 * The helper names the first name back to the person. It is the cheapest possible proof
 * that the flow remembered the previous answer, on the screen where "did that save?" is the
 * question a one-question-per-page flow invites — and it is the same value Back would
 * return them to (E-46).
 */

const STEP = AUTH_STEPS[3];

export default function LastNamePage() {
  const { values } = useAuthFlow();
  const inputRef = useAutoFocus<HTMLInputElement>();
  const { value, setValue, error, submit, screenState } = useStepAnswer({
    step: STEP,
    field: "lastName",
    validate: validateLastName,
    focusRef: inputRef,
  });

  const firstName = values.firstName.trim();

  return (
    <AuthStepForm
      step={STEP}
      question="And your last name?"
      helper={
        firstName.length === 0
          ? "Both names show on the card. Nothing else about you does, unless you add it."
          : `${firstName} and your last name are what people save. Nothing else, unless you add it.`
      }
      screenState={screenState}
      onSubmit={submit}
      submitLabel="Continue"
    >
      <Input
        ref={inputRef}
        label="Last name"
        hideLabel
        type="text"
        autoComplete="family-name"
        autoCapitalize="words"
        spellCheck={false}
        maxLength={MAX_NAME_LENGTH}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={error}
      />
    </AuthStepForm>
  );
}

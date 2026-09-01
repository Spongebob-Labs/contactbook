"use client";

import {
  AuthStepForm,
  useAutoFocus,
  useStepAnswer,
} from "@/components/auth/auth-step-form";
import { Input } from "@/components/primitives";
import { AUTH_STEPS } from "@/lib/auth-flow-context";
import { MAX_NAME_LENGTH, validateFirstName } from "@/lib/auth-validation";

/**
 * A-3 — "What's your first name?" (spec §8D.2, R-05).
 *
 * `maxLength` stops the 41st character rather than reporting it afterwards; the validator
 * still measures the length, because a paste is not a keystroke. Prevention first, message
 * second — the message exists for the case prevention cannot reach.
 */

const STEP = AUTH_STEPS[2];

export default function FirstNamePage() {
  const inputRef = useAutoFocus<HTMLInputElement>();
  const { value, setValue, error, submit, screenState } = useStepAnswer({
    step: STEP,
    field: "firstName",
    validate: validateFirstName,
    focusRef: inputRef,
  });

  return (
    <AuthStepForm
      step={STEP}
      question="What's your first name?"
      helper="It goes on the front of every card you make."
      screenState={screenState}
      onSubmit={submit}
      submitLabel="Continue"
    >
      <Input
        ref={inputRef}
        label="First name"
        hideLabel
        type="text"
        autoComplete="given-name"
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

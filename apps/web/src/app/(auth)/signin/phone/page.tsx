"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  AuthStepForm,
  useAutoFocus,
  useStepAnswer,
} from "@/components/auth/auth-step-form";
import { CountrySelect } from "@/components/auth/country-select";
import { Input } from "@/components/primitives";
import { requestOtp, type RequestOtpOutcome } from "@/lib/auth-flow-api";
import { AUTH_STEPS, useAuthFlow } from "@/lib/auth-flow-context";
import { MAX_PHONE_DIGITS, digitsOnly, validatePhone } from "@/lib/auth-validation";

/**
 * A-1 — "What's your number?" (spec §8D.2, R-03).
 *
 * Two controls, one question: the dialling code is a fact about the number, not a second thing
 * to decide. They sit side by side from 640px and stack below it, because at 360px a 140px
 * picker beside a phone field leaves neither of them room.
 *
 * **A code is now actually sent.** Submitting calls `POST /auth/otp/request`, so the two
 * failures that screen can produce are real and rate-limit shaped: `OTP_COOLDOWN` (asked again
 * inside 60s) and `OTP_RATE_LIMITED` (five in an hour). Both render under the field.
 *
 * The field filters keystrokes through `digitsOnly`, so the value can only ever fail
 * `validatePhone` on length — the "digits only" message exists for a paste.
 */

const STEP = AUTH_STEPS[0];

export default function PhonePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { values, setValue: setFlowValue, setDevCode } = useAuthFlow();
  const inputRef = useAutoFocus<HTMLInputElement>();

  // Carried forward by hand, because a route group's search params do not survive a
  // `router.push` to a sibling. `proxy.ts` sets `?next=` when it bounces someone out of a
  // protected route, and dropping it here is what would land them on the dashboard instead of
  // the card they were actually opening.
  const next = searchParams.get("next");

  const { value, setValue, error, submit, screenState, pending } = useStepAnswer<RequestOtpOutcome>(
    {
      step: STEP,
      field: "phone",
      validate: validatePhone,
      focusRef: inputRef,
      action: (phone) => requestOtp(values.country, phone),
      onSuccess: (outcome) => {
        // Only present when the API sent no WhatsApp message (staging without Twilio). Held in
        // context rather than the URL so a real code never lands in browser history.
        setDevCode(outcome.devCode ?? null);
        const target =
          next === null ? STEP.nextHref : `${STEP.nextHref}?next=${encodeURIComponent(next)}`;
        if (target !== null) router.push(target);
      },
    },
  );

  return (
    <AuthStepForm
      step={STEP}
      question="What's your number?"
      helper="We'll message you a six-digit code on WhatsApp to sign in."
      screenState={screenState}
      onSubmit={submit}
      submitLabel="Send code"
      submitPending={pending}
      submitPendingLabel="Sending…"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-3">
        <CountrySelect
          value={values.country}
          onValueChange={(code) => setFlowValue("country", code)}
          className="sm:w-48 sm:shrink-0"
        />

        <Input
          ref={inputRef}
          label="Phone number"
          hideLabel
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={MAX_PHONE_DIGITS}
          placeholder="9876543210"
          value={value}
          onChange={(event) =>
            setValue(digitsOnly(event.target.value).slice(0, MAX_PHONE_DIGITS))
          }
          error={error}
          fieldClassName="min-w-0 flex-1"
        />
      </div>
    </AuthStepForm>
  );
}

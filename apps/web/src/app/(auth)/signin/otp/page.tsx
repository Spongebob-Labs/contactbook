"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthStepForm, useStepAnswer } from "@/components/auth/auth-step-form";
import { dialledNumber } from "@/components/auth/country-select";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/primitives";
import { requestOtp, verifyOtp, type VerifyOtpOutcome } from "@/lib/auth-flow-api";
import { AUTH_STEPS, useAuthFlow } from "@/lib/auth-flow-context";
import { validateOtp } from "@/lib/auth-validation";

/**
 * A-2 — "Enter the code we sent" (spec §8D.2, R-04).
 *
 * **The code is real now, and so are its four failure modes** — all of them reachable by
 * typing, which is why this screen no longer needs `?state=error` to demonstrate an error:
 * `OTP_INVALID` (wrong digits), `OTP_NOT_FOUND` (expired), `OTP_ATTEMPTS_EXCEEDED` (five wrong
 * guesses — even the right code is now dead) and `OTP_COOLDOWN` on the resend.
 *
 * ## The branch that matters
 * Verifying is where signup and login stop being different things: the API creates the User on
 * first verification, so the only question left is whether that user has a profile yet.
 * `isOnboardingCompleted` (on the verify response itself) answers it, and this screen is the only place in the flow that reads
 * it — a returning user finishes here, at step two of six, and a new one carries on to step
 * three.
 */

const STEP = AUTH_STEPS[1];
const RESEND_SECONDS = 30;

export default function OtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { values, devCode } = useAuthFlow();
  const next = searchParams.get("next");

  const { value, setValue, error, submit, screenState, pending } = useStepAnswer<VerifyOtpOutcome>({
    step: STEP,
    field: "otp",
    validate: validateOtp,
    action: (code) => verifyOtp(values.country, values.phone, code),
    onSuccess: (outcome) => {
      // A session exists from this moment either way — the difference is only where it lands.
      router.push(
        outcome.isOnboardingCompleted ? (next ?? "/dashboard") : "/signup/first-name",
      );
    },
  });

  // The flow's answers are in memory, so a reload here loses the number the code was sent to —
  // and without it there is nothing to verify against. §5.7 accepts that reloading restarts the
  // flow; this makes the restart a redirect rather than a form that cannot succeed.
  const phoneMissing = values.phone.length === 0;
  useEffect(() => {
    if (phoneMissing) router.replace("/signin/phone");
  }, [phoneMissing, router]);

  const destination =
    values.phone.length > 0 ? dialledNumber(values.country, values.phone) : null;

  return (
    <AuthStepForm
      step={STEP}
      question="Enter the code we sent"
      helper={
        destination === null
          ? "Six digits, from the WhatsApp message on your phone."
          : `Six digits, sent on WhatsApp to ${destination}.`
      }
      screenState={screenState}
      onSubmit={submit}
      submitLabel="Verify"
      submitPending={pending || screenState === "loading"}
      submitPendingLabel="Checking…"
      footer={
        <>
          {devCode === null ? null : <DevCodeNotice code={devCode} />}
          <ResendRow country={values.country} phone={values.phone} />
        </>
      }
    >
      <OtpInput value={value} onChange={setValue} error={error} />
    </AuthStepForm>
  );
}

/**
 * The code, shown on screen, when the API returned it instead of sending a message.
 *
 * `RequestOtpResponseDto.devCode` is populated only outside production and only when Twilio is
 * unconfigured — the server decides, and if it is here then no WhatsApp message exists to go
 * looking for. Rendering it is what makes the flow completable on staging; labelling it plainly
 * is what stops it reading as a bug.
 */
function DevCodeNotice({ code }: { code: string }) {
  return (
    <div
      data-auth-dev-code={code}
      className="flex flex-col gap-1 rounded-md border border-dashed border-line bg-surface-sunk px-4 py-3"
    >
      <p className="text-sm text-ink-3">
        Staging: no WhatsApp message was sent, so the code is shown here.
      </p>
      <p className="font-mono text-lg tracking-[0.2em] text-ink">{code}</p>
    </div>
  );
}

/**
 * "Resend code" behind a 30-second countdown (§8D.2 A-2).
 *
 * The countdown is a client-side courtesy over the top of the server's real rule — the API
 * enforces a 60s cooldown and a 5/hour cap regardless. So a resend can still fail, and when it
 * does the reason is shown rather than swallowed: pressing a button that silently did nothing
 * is worse than being told to wait.
 *
 * The button stays focusable while it waits — T05's `Button` uses `aria-disabled`, never the
 * native attribute, so it never drops out of the tab order (AC-26) and it carries a reason.
 */
function ResendRow({ country, phone }: { country: string; phone: string }) {
  const { setDevCode } = useAuthFlow();
  const [remaining, setRemaining] = useState(RESEND_SECONDS);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (remaining === 0) return;
    const timer = window.setTimeout(() => setRemaining((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  const waiting = remaining > 0 || pending;

  return (
    <div
      data-auth-resend=""
      data-resend-remaining={remaining}
      data-resend-state={waiting ? "waiting" : "ready"}
      className="flex flex-col gap-2 border-t border-line pt-6"
    >
      <Button
        variant="text-link"
        disabled={waiting}
        disabledReason="You can ask for another code when the countdown ends."
        onClick={() => {
          startTransition(async () => {
            const result = await requestOtp(country, phone);
            if (result.ok) {
              setDevCode(result.data.devCode ?? null);
              setRemaining(RESEND_SECONDS);
              setNotice("We sent another code.");
              return;
            }
            // The server's own cooldown, which outranks our countdown. Restart the timer so
            // the button does not invite an immediate second failure.
            setRemaining(RESEND_SECONDS);
            setNotice(result.error.detail.length > 0 ? result.error.detail : result.error.title);
          });
        }}
      >
        {waiting ? `Resend code in ${remaining}s` : "Resend code"}
      </Button>

      {/* Announced once, when it changes — never a toast for something this small. */}
      <p role="status" className="text-sm text-ink-3">
        {notice ?? ""}
      </p>
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { ActionResult } from "@/lib/actions/result";
import type { ApiErrorCode } from "@/lib/api/errors";

import { Button } from "@/components/primitives";
import { useAuthFlow, type AuthFlowValues, type AuthStep } from "@/lib/auth-flow-context";
import type { AuthValidation } from "@/lib/auth-validation";
import { cn } from "@/lib/cn";
import { STATE_PARAM, parseScreenState } from "@/lib/screen-state";

/**
 * The skeleton all six screens fill in — spec §8D.2's "rules for all six".
 *
 * Every clause of that paragraph is implemented **here, once**, rather than six times:
 * the headline is `--text-h2`, the helper is `--text-lg --ink-3`, there is
 * exactly **one** primary action and it is full width on mobile, **Enter submits** (native
 * implicit submission — the primary is a real `type="submit"`), and the step enters with a
 * 16px horizontal slide + fade at `--dur-slow`.
 *
 * The two clauses that are deliberately NOT here:
 * · **Progress and Back** live in `auth-shell.tsx`, derived from the pathname. Six pages
 *   that each remembered to render their own progress bar is six chances to forget one, and
 *   AC-28 asks for it on every screen.
 * · **The error message** belongs to the control, not to the form. T05's `Field` already
 *   renders it with `role="alert"` and wires `aria-describedby` to the input (§8D.2), so a
 *   second error slot up here would announce everything twice and point at nothing.
 */

/* ── The step transition ──────────────────────────────────────────────────────────────
   Shipped as a hoisted stylesheet rather than an inline style because a keyframe cannot be
   expressed inline, and `src/styles/globals.css` belongs to T02 (plan §1.2). React 19
   hoists `<style href precedence>` into `<head>` and dedupes by `href`, so all six screens
   rendering it produces exactly one rule — the same mechanism T08 uses for the elevation
   sheet.

   Reduced motion needs nothing here: `globals.css` zeroes `--dur-slow` centrally (§8.9,
   AC-27), so the animation lands on its end state on the first frame. That is the whole
   reason the duration is a token and not a literal. */

export const AUTH_STEP_STYLE_HREF = "contactbook-auth-step";

export const AUTH_STEP_CSS = `
@keyframes cb-auth-step-enter {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: none; }
}
[data-auth-step-form] {
  animation: cb-auth-step-enter var(--dur-slow) var(--ease-out) both;
}
`;

export function AuthStepStyles() {
  return (
    <style href={AUTH_STEP_STYLE_HREF} precedence="default">
      {AUTH_STEP_CSS}
    </style>
  );
}

/* ── `?state=` on a form screen ───────────────────────────────────────────────────────── */

/** The three states §6.1 declares for the auth rows. */
export type AuthStepState = "success" | "error" | "loading";

/**
 * Make the declared `error` and `loading` states of R-03…R-08 reachable by URL.
 *
 * §6.3 exists because "loading/error/offline states would be unreachable and therefore
 * untestable" without it, and that argument applies exactly as much to a form that never
 * submits anywhere as to a list that never fetches. `?state=error` renders the screen's
 * real validation message; `?state=loading` puts the OTP screen's verify button in its busy
 * state. Anything else — including `empty`, `offline` and `?state=banana` — is `success`
 * (§11 E-34: never throws, never blanks the page).
 *
 * Reading `useSearchParams` is what makes every step a client component, and it is why
 * `(auth)/layout.tsx` puts a `<Suspense>` boundary above `children` (plan §0.5).
 */
export function useAuthStepState(): AuthStepState {
  const searchParams = useSearchParams();
  const state = parseScreenState(searchParams.get(STATE_PARAM));
  return state === "error" || state === "loading" ? state : "success";
}

/**
 * Focus the first field on mount — §8D.2, on every one of the six screens.
 *
 * An effect rather than `autoFocus`: the pages are prerendered, and a focus that depends on
 * hydration timing is the kind of thing that passes locally and fails in CI. Returned as a
 * ref so the page can also re-focus the field after a failed validation, which is the other
 * half of not making someone hunt for where their mistake was.
 */
export function useAutoFocus<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

/**
 * The error appears **after the first submit**, never on mount: a form that turns red before
 * anyone has typed is telling someone off for arriving. `?state=error` is the one exception,
 * because that URL exists precisely to show the error surface (§6.3).
 */
export interface StepAnswer {
  value: string;
  setValue: (next: string) => void;
  /** `null` until there is something to say. Pass it straight to the control's `error`. */
  error: string | null;
  /** Validate; on success run the action (if any) or navigate, on failure focus the field. */
  submit: () => void;
  screenState: AuthStepState;
  /**
   * True while the step's action is in flight. Drives the submit button's busy state.
   *
   * Always `false` on a step with no action, so `?state=loading` remains the only way to reach
   * the busy surface on those — which is what keeps the §6.3 states testable.
   */
  pending: boolean;
  /**
   * The API's stable code for the last failure, or `null`.
   *
   * Exposed so a screen can branch on *what* went wrong without matching on prose — the OTP
   * screen restarts its countdown on `OTP_COOLDOWN` rather than re-enabling the button.
   */
  failureCode: ApiErrorCode | null;
}

/**
 * One answer, its error, and the rule that a bad answer never advances the flow.
 *
 * Pass `action` and the step calls the API on submit: the button goes busy, a failure renders
 * beside the field, and only a success navigates. Omit it and the step behaves exactly as it
 * did before — validate and move on — which is what the two name screens still want, since
 * their answers are not sent anywhere until the email step submits all three together.
 */
export function useStepAnswer<T = undefined>({
  step,
  field,
  validate,
  focusRef,
  action,
  onSuccess,
}: {
  step: AuthStep;
  field: keyof AuthFlowValues;
  validate: (raw: string) => AuthValidation;
  focusRef?: RefObject<HTMLElement | null>;
  /** Runs after client-side validation passes. Its `ActionResult` decides what happens next. */
  action?: (value: string) => Promise<ActionResult<T>>;
  /** Where a success goes. Defaults to the step's `nextHref`. */
  onSuccess?: (data: T) => void;
}): StepAnswer {
  const router = useRouter();
  const { values, setValue: setFlowValue } = useAuthFlow();
  const screenState = useAuthStepState();
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<{ message: string; code: ApiErrorCode } | null>(null);

  const value = values[field];
  const validation = validate(value);
  const showError = (submitted || screenState === "error") && !validation.valid;

  const setValue = useCallback(
    (next: string) => {
      setFlowValue(field, next);
      // Clear the server's verdict the moment the input changes: an "that code didn't match"
      // still sitting under a field the user has since corrected is stale and reads as broken.
      setFailure(null);
    },
    [setFlowValue, field],
  );

  const submit = useCallback(() => {
    setSubmitted(true);
    setFailure(null);

    const current = values[field];
    if (!validate(current).valid) {
      focusRef?.current?.focus();
      return;
    }

    const advance = () => {
      if (onSuccess !== undefined) return;
      if (step.nextHref !== null) router.push(step.nextHref);
    };

    if (action === undefined) {
      advance();
      return;
    }

    startTransition(async () => {
      const result = await action(current);
      if (result.ok) {
        if (onSuccess !== undefined) onSuccess(result.data);
        else advance();
        return;
      }
      // `detail` is the sentence that says what to do next; the title alone is often just a
      // label ("Give it a moment"), so both are shown when both exist.
      const { title, detail } = result.error;
      setFailure({
        message: detail.length > 0 ? `${title}. ${detail}` : title,
        code: result.code,
      });
      focusRef?.current?.focus();
    });
  }, [validate, values, field, focusRef, step.nextHref, router, action, onSuccess]);

  return {
    value,
    setValue,
    // A server failure outranks the format message: it is newer, and it is about the value the
    // user actually submitted rather than the shape of what they typed.
    error: failure?.message ?? (showError ? validation.message : null),
    submit,
    screenState,
    pending,
    failureCode: failure?.code ?? null,
  };
}

/* ── The shared shape ─────────────────────────────────────────────────────────────────── */

interface AuthStepFormBaseProps {
  step: AuthStep;
  /** The one question. Rendered as the page's `<h1>`. */
  question: string;
  helper?: ReactNode;
  /** Drives `data-screen-state`. Defaults to `success`. */
  screenState?: AuthStepState;
  /** The control(s) that answer the question. */
  children?: ReactNode;
  /** A visible secondary action — A-5's "Skip for now" is the only one (§8D.2). */
  secondary?: ReactNode;
  /** Below the actions: the OTP resend timer. */
  footer?: ReactNode;
  className?: string;
}

export interface AuthStepFormProps extends AuthStepFormBaseProps {
  /** Present on the five question screens; absent on the confirmation screen. */
  onSubmit?: () => void;
  submitLabel?: string;
  submitPending?: boolean;
  submitPendingLabel?: string;
  /** Replaces the submit button — `/signup/done` navigates rather than submits. */
  primary?: ReactNode;
}

export function AuthStepForm({
  step,
  question,
  helper,
  screenState = "success",
  children,
  secondary,
  footer,
  className,
  onSubmit,
  submitLabel,
  submitPending = false,
  submitPendingLabel,
  primary,
}: AuthStepFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.();
  }

  const body = (
    <>
      <AuthStepStyles />

      <div className="flex flex-col gap-3">
        <h1 data-auth-question="" className="text-h2 text-ink">
          {question}
        </h1>
        {helper === undefined ? null : (
          <p data-prose="" className="text-lg text-ink-3">
            {helper}
          </p>
        )}
      </div>

      {children}

      <div className="flex flex-col items-start gap-4">
        {primary ?? (
          <Button
            type="submit"
            size="lg"
            data-auth-primary=""
            loading={submitPending}
            loadingLabel={submitPendingLabel}
            className="w-full md:w-auto md:min-w-40"
          >
            {submitLabel}
          </Button>
        )}
        {secondary}
      </div>

      {footer}
    </>
  );

  const rootProps = {
    "data-auth-step-form": "",
    "data-auth-step": step.index,
    "data-auth-step-id": step.id,
    "data-screen-state": screenState,
    className: cn("flex flex-col gap-8", className),
  } as const;

  // A `<form>` is what makes Enter submit. The confirmation screen has nothing to submit,
  // so it is a plain block rather than a form wrapped around a link.
  return onSubmit === undefined ? (
    <div {...rootProps}>{body}</div>
  ) : (
    <form {...rootProps} noValidate onSubmit={handleSubmit}>
      {body}
    </form>
  );
}

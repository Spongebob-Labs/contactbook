"use client";

import { useState } from "react";

import type { LeadKind, LeadProblem } from "@/lib/leads";

import { mkcn } from "./mk-cn";
import { Prose } from "./type";

/**
 * The waitlist form and the contact form. One component; the fields differ.
 *
 * ## ⚠ ONE SHORT FORM, NOT ONE QUESTION PER SCREEN
 * Sign-up in the product asks one question per screen and that is right there — somebody has
 * already decided to use it. A waitlist is the opposite situation: nobody has decided anything,
 * and every extra screen is a place to leave. Four fields, one submit, one page.
 *
 * ## The states, and why the failure state is the interesting one
 * `idle → sending → done | failed`, and `failed` is not an error message. Where a submission
 * goes is configuration (`LEAD_WEBHOOK_URL`; see `src/lib/leads.ts`), so "not wired up yet" is a
 * state this form will genuinely be in, and it must not be a dead end: it shows the same copy a
 * delivery failure would, with a real mailto. The visitor can still reach us either way, and
 * the one thing that never happens is a tick over a submission nobody received.
 *
 * ## What this does NOT do
 * No optimistic success. No retry loop. No local draft. The whole interaction is one POST, and
 * the honest answer to it is either yes or "email us instead".
 */

export interface LeadFieldSpec {
  readonly name: "name" | "email" | "phone" | "company" | "message";
  readonly label: string;
  readonly type?: "text" | "email" | "tel" | "textarea";
  readonly optional?: boolean;
  readonly autoComplete?: string;
}

const CONTROL = mkcn(
  "block w-full rounded-mk-control bg-mk-white px-4 py-3 text-mk-body text-mk-ink",
  // `--mk-control` is the 3:1 boundary colour: an input whose edge you cannot find is an input
  // sighted users miss and WCAG 1.4.11 fails.
  "ring-1 ring-inset ring-mk-control",
  "placeholder:text-mk-pebble",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-ink",
);

const LABEL = "block text-mk-body-sm font-mk-medium text-mk-ink";

export function LeadForm({
  kind,
  fields,
  submitLabel,
  successHeading,
  successBody,
  fallbackBody,
  fallbackEmail,
  privacyNote,
  audienceQuestion,
}: {
  kind: LeadKind;
  fields: readonly LeadFieldSpec[];
  submitLabel: string;
  successHeading: string;
  successBody: string;
  fallbackBody: string;
  fallbackEmail: string;
  privacyNote: string;
  /** Waitlist only: the individual-or-company radio pair. */
  audienceQuestion?: { readonly legend: string; readonly individual: string; readonly company: string };
}) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "failed">("idle");
  const [problems, setProblems] = useState<readonly LeadProblem[]>([]);

  const problemFor = (field: string) => problems.find((p) => p.field === field)?.message;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState("sending");
    setProblems([]);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, ...Object.fromEntries(data.entries()) }),
      });
      if (res.ok) {
        setState("done");
        form.reset();
        return;
      }
      /* 422 is the only status that carries field problems. Anything else — no destination
         configured, a webhook that failed or timed out — is the fallback, because from the
         visitor's side those are the same event. */
      if (res.status === 422) {
        const payload = (await res.json()) as { problems?: LeadProblem[] };
        setProblems(payload.problems ?? []);
        setState("idle");
        return;
      }
      setState("failed");
    } catch {
      setState("failed");
    }
  }

  if (state === "done") {
    return (
      <div data-lead-state="done" className="rounded-mk-block bg-mk-white p-8 ring-1 ring-mk-hairline-strong">
        <p className="font-mk-display text-mk-heading-sm font-mk-editorial text-mk-ink">
          {successHeading}
        </p>
        <Prose className="mt-3">{successBody}</Prose>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate data-lead-form={kind} className="max-w-mk-measure">
      {/*
        The honeypot. Off-screen rather than `display: none` — some bots skip hidden inputs but
        fill positioned ones — with `tabIndex={-1}` and `aria-hidden` so no keyboard or screen
        reader ever reaches it. `autoComplete="off"` keeps a browser from helpfully filling it in
        and locking a real person out of the form.
      */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="company_website">Company website</label>
        <input id="company_website" name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-5">
        {fields.map((field) => {
          const problem = problemFor(field.name);
          const id = `lead-${field.name}`;
          return (
            <div key={field.name}>
              <label htmlFor={id} className={LABEL}>
                {field.label}
                {field.optional ? (
                  <span className="ml-2 font-mk-regular text-mk-caption text-mk-stone">
                    optional
                  </span>
                ) : null}
              </label>

              {field.type === "textarea" ? (
                <textarea
                  id={id}
                  name={field.name}
                  rows={5}
                  required={!field.optional}
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={problem ? `${id}-problem` : undefined}
                  className={mkcn(CONTROL, "mt-2 resize-y")}
                />
              ) : (
                <input
                  id={id}
                  name={field.name}
                  type={field.type ?? "text"}
                  required={!field.optional}
                  autoComplete={field.autoComplete}
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={problem ? `${id}-problem` : undefined}
                  className={mkcn(CONTROL, "mt-2")}
                />
              )}

              {/* `--mk-oxblood` at 12.13:1, and the message says what to do rather than what
                  went wrong. Never colour alone: the text is the error. */}
              {problem ? (
                <p id={`${id}-problem`} className="mt-2 text-mk-body-sm text-mk-oxblood">
                  {problem}
                </p>
              ) : null}
            </div>
          );
        })}

        {audienceQuestion ? (
          <fieldset>
            <legend className={LABEL}>{audienceQuestion.legend}</legend>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
              {(
                [
                  ["individual", audienceQuestion.individual],
                  ["company", audienceQuestion.company],
                ] as const
              ).map(([value, label], i) => (
                <label key={value} className="flex items-center gap-2 text-mk-body text-mk-ink">
                  <input
                    type="radio"
                    name="audience"
                    value={value}
                    defaultChecked={i === 0}
                    className="size-4 accent-mk-green-deep"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={state === "sending"}
        className={mkcn(
          "mt-8 inline-flex min-h-11 items-center justify-center rounded-mk-control px-6 py-3",
          "bg-mk-ink font-mk-medium text-mk-white",
          "transition-colors duration-[var(--mk-dur-tap)]",
          "hover:bg-mk-ink/90 disabled:opacity-70",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-ink",
        )}
      >
        {state === "sending" ? "Sending…" : submitLabel}
      </button>

      {/* `aria-live` so a submission that fails is announced rather than only appearing. */}
      <div aria-live="polite">
        {state === "failed" ? (
          <div
            data-lead-state="failed"
            className="mt-6 rounded-mk-row bg-mk-white p-5 ring-1 ring-mk-hairline-strong"
          >
            <Prose size="small">{fallbackBody}</Prose>
            <a
              href={`mailto:${fallbackEmail}`}
              className="mt-1 inline-block font-mk-medium text-mk-body-sm text-mk-green-ink underline decoration-1 underline-offset-2"
            >
              {fallbackEmail}
            </a>
          </div>
        ) : null}
      </div>

      <Prose size="small" className="mt-6 max-w-mk-measure-tight">
        {privacyNote}
      </Prose>
    </form>
  );
}

/**
 * Where a form submission goes, and the only place that decision is made.
 *
 * ## ⚠ THE DESTINATION IS CONFIGURATION, NOT CODE
 * `/waitlist` and `/contact` both post to `/api/leads`, which calls `deliverLead` below, which
 * forwards to **`LEAD_WEBHOOK_URL`**. Set that to anything that accepts a JSON POST — a form
 * service, a Zapier or Make hook, a Slack incoming webhook, or a real endpoint on the NestJS
 * API when one exists — and both pages start working with no edit to any file.
 *
 * It is built this way because the destination was an open question when the pages were built
 * and the frontend is identical whichever way it is answered. The alternatives were worse: a
 * store client in `apps/web` would break the house rule that the web app talks only to the API
 * (`API_BASE_URL`, `/api/cb/*`), and inventing a waitlist table on an API that is currently an
 * empty rebuild is backend architecture smuggled in behind a form.
 *
 * ## ⚠ AND IT NEVER PRETENDS TO HAVE SAVED SOMETHING
 * With no `LEAD_WEBHOOK_URL`, `deliverLead` returns `"unconfigured"` — it does not swallow the
 * submission and return success. The forms surface that as "we could not record that, email us
 * at …" with a real address. A waitlist form that shows a tick and drops the row is worse than
 * one that admits it is not wired up, because the visitor is gone either way and only one of
 * those tells you.
 *
 * ## What is validated here rather than in the browser
 * Everything. Client-side validation is a courtesy to the person typing; it is not a check,
 * because anything can post to this route. The rules are deliberately permissive — a real
 * address that a clever regex rejects is a lost customer, and the address is confirmed by
 * whether the reply arrives, not by its shape.
 */

/** Which form this came from. Kept on the payload so one destination can serve both. */
export type LeadKind = "waitlist" | "enquiry";

export interface Lead {
  readonly kind: LeadKind;
  readonly name: string;
  readonly email: string;
  readonly phone?: string;
  readonly company?: string;
  /** Waitlist only: signing up for themselves or for an organisation. */
  readonly audience?: "individual" | "company";
  /** Enquiry only. */
  readonly message?: string;
}

export type LeadResult = "delivered" | "unconfigured" | "failed";

/** Field length ceilings. Generous, and there only to bound what can be posted at us. */
const LIMITS = { name: 120, email: 254, phone: 40, company: 160, message: 4000 } as const;

export interface LeadProblem {
  readonly field: string;
  readonly message: string;
}

/**
 * A permissive shape check: something, an `@`, something with a dot in it, no spaces.
 *
 * Deliberately not a full RFC 5322 grammar. Those regexes are famous for rejecting valid
 * addresses, and the only real test of an address is whether mail to it arrives — which is
 * exactly what the confirmation reply is.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Validates and normalises an unknown JSON body into a `Lead`, or returns what is wrong. */
export function parseLead(
  body: unknown,
): { ok: true; lead: Lead } | { ok: false; problems: LeadProblem[] } {
  const raw = (body ?? {}) as Record<string, unknown>;
  const problems: LeadProblem[] = [];

  const kind: LeadKind = raw.kind === "enquiry" ? "enquiry" : "waitlist";
  const name = text(raw.name);
  const email = text(raw.email);
  const phone = text(raw.phone);
  const company = text(raw.company);
  const message = text(raw.message);

  if (!name) problems.push({ field: "name", message: "Tell us your name." });
  if (name.length > LIMITS.name) problems.push({ field: "name", message: "That name is too long." });

  if (!email) problems.push({ field: "email", message: "We need an email address to reply to." });
  else if (email.length > LIMITS.email || !EMAIL.test(email))
    problems.push({ field: "email", message: "That does not look like an email address." });

  if (phone.length > LIMITS.phone)
    problems.push({ field: "phone", message: "That number is too long." });
  if (company.length > LIMITS.company)
    problems.push({ field: "company", message: "That company name is too long." });

  if (kind === "enquiry") {
    if (!message) problems.push({ field: "message", message: "Tell us what you would like to know." });
    else if (message.length > LIMITS.message)
      problems.push({ field: "message", message: "That message is too long to send." });
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    lead: {
      kind,
      name,
      email,
      ...(phone ? { phone } : {}),
      ...(company ? { company } : {}),
      ...(kind === "waitlist"
        ? { audience: raw.audience === "company" ? ("company" as const) : ("individual" as const) }
        : {}),
      ...(kind === "enquiry" ? { message } : {}),
    },
  };
}

/**
 * Forwards a validated lead to `LEAD_WEBHOOK_URL`.
 *
 * The timeout matters: this runs inside a request the visitor is waiting on, and a webhook that
 * hangs would leave them looking at a spinner until the platform kills the function. Ten
 * seconds, then it is a `"failed"` and the form offers the email fallback.
 */
export async function deliverLead(lead: Lead): Promise<LeadResult> {
  const url = process.env.LEAD_WEBHOOK_URL?.trim();
  if (!url) return "unconfigured";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...lead, receivedAt: new Date().toISOString(), source: "website" }),
      signal: controller.signal,
      cache: "no-store",
    });
    return res.ok ? "delivered" : "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}

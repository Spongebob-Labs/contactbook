import { NextResponse } from "next/server";

import { deliverLead, parseLead } from "@/lib/leads";

/**
 * `POST /api/leads` — the waitlist form and the contact form, both.
 *
 * One route for two forms, because they differ only in which fields they collect: the
 * destination, the validation, the spam handling and the failure semantics are identical, and
 * two routes would have been the same file twice. `kind` on the body says which form it was and
 * travels through to the webhook payload.
 *
 * Where a submission actually goes, and why that is an env var rather than a decision baked in
 * here, is documented in `src/lib/leads.ts`. Read that before changing anything below.
 *
 * ## The three answers this route can give, and the one it must never give
 *   · **200 `{ ok: true }`** — the webhook accepted it.
 *   · **422 `{ problems }`** — the body is not a lead. Field-level messages, so the form can put
 *     each one against its input.
 *   · **503 `{ reason }`** — there is no destination configured, or the webhook failed. The form
 *     shows its email fallback.
 *
 * ⚠ It must never return 200 for a submission it did not deliver. A tick on a waitlist form
 * that dropped the row is worse than an honest failure: the visitor is gone in both cases and
 * only one of them tells you it happened.
 */
export async function POST(request: Request) {
  /* A body cap before parsing. This is a public, unauthenticated route, and `request.json()`
     will happily buffer whatever it is handed. */
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 16_000) {
    return NextResponse.json({ ok: false, reason: "too-large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "malformed" }, { status: 400 });
  }

  /**
   * ⚠ THE HONEYPOT IS CHECKED BEFORE VALIDATION AND ANSWERS 200.
   *
   * `company_website` is a field rendered off-screen with no label a person will ever see;
   * anything in it came from something filling every input it found. It returns a plain 200 so
   * the bot has no signal to tune against — a 4xx tells a scraper it was detected, which is
   * information we have no reason to give away. Nothing is forwarded.
   *
   * This is not real bot protection and is not sold as any. It removes the cheapest kind of
   * form spam; if the address starts attracting the expensive kind, the answer is a challenge
   * at the edge, not a longer regex here.
   */
  if (typeof (body as Record<string, unknown>)?.company_website === "string") {
    const trap = (body as Record<string, string>).company_website.trim();
    if (trap) return NextResponse.json({ ok: true });
  }

  const parsed = parseLead(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, problems: parsed.problems }, { status: 422 });
  }

  const result = await deliverLead(parsed.lead);
  if (result === "delivered") return NextResponse.json({ ok: true });

  return NextResponse.json({ ok: false, reason: result }, { status: 503 });
}

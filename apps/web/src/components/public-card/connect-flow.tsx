"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

import { Check, UserPlus } from "lucide-react";

import { CardActionButton } from "@/card/card-action-button";
import { paletteVars } from "@/card/template-palettes";
import { publicConnect } from "@/lib/api/browser";
import { isApiError, toScreenError } from "@/lib/api/errors";
import { digitsOnly, validateOtp, validatePhone } from "@/lib/auth-validation";
import { COUNTRIES, toE164 } from "@/lib/countries";
import type { ResolvedCard } from "@/types/domain";

/**
 * "Save & connect" — the third action on a scanned card, and the only one that talks to the API.
 *
 * ## What it is for
 * Scanning a QR and reading this page already works, and leaves the scanner an anonymous line in
 * a `CardScan` counter. This turns that into a real `ShareLink`: once they have proved they own
 * the number they typed, the owner can notify them when the card changes. It is the recipient
 * half of `POST /cards/{id}/share`, initiated by the recipient.
 *
 * ## What it deliberately is not
 * **Not a login.** `OtpService.verifyChallenge` proves phone ownership and stops — no `User` row,
 * no session, no cookie, no redirect. So there is nothing to navigate to on success, and this
 * component ends on a confirmation rather than a route change.
 *
 * **Not a re-fetch.** The card on screen was resolved from live data by the page's own
 * `fetchPublicCard`, and connecting changes nothing about it. A success state layers on top; the
 * card underneath is still correct.
 *
 * **Not automatic.** It is a deliberate tap. A scanner who ignores it stays exactly as anonymous
 * as they are today — which is the whole reason this is a button and not an effect.
 *
 * ## The four states, and why the flow is inline
 * `idle → phone → code → done`, all in the actions tier, replacing the trigger in place. No
 * modal: the card is the thing the reader came for, and a sheet over it to type six digits buys
 * nothing. The two existing actions stay visible throughout, because starting to connect is not
 * a reason to lose "Save to contacts".
 *
 * ## Cooldown comes from the server, never from us
 * `OTP_COOLDOWN` carries `details.retryAfterSeconds`, and that value drives the resend timer.
 * A locally invented countdown would be a guess about someone else's rule — the API enforces
 * 60s between requests and 5 per hour per phone regardless of what this component believes. The
 * 60s started after a *successful* send is a courtesy that matches the documented rule; the
 * moment the server disagrees, {@link ConnectFlow} takes the server's number.
 *
 * ## Palette, not app chrome
 * Every colour here is a `--c-*` var from {@link paletteVars}, the same source
 * `CardActionButton` paints from. The field stack stands on the palette ground, so an input
 * styled with the app's white-chrome tokens (`border-line`, `bg-surface-sunk`) would be a white
 * box on a bold ground. The vars are re-applied on this element for the same reason the button
 * re-applies them: this subtree is not guaranteed to be inside a card root.
 */

/** The API's documented gap between requests. Only ever an initial value — the server can override. */
const RESEND_SECONDS = 60;

/** Where the flow is. `done` is terminal; `dead` is a token that stopped resolving mid-flow. */
type Stage = "idle" | "phone" | "code" | "done" | "dead";

export interface ConnectFlowProps {
  resolved: ResolvedCard;
  /**
   * The share token from the route — `/c/{token}`.
   *
   * Passed down rather than read from `window.location`: the page already has it as a route
   * param, and re-deriving it from the URL here would be a second, less reliable definition of
   * the same string.
   */
  token: string;
}

/** `OTP_COOLDOWN`'s retry hint, when the envelope carried a usable one. */
function retryAfterFrom(error: unknown): number | null {
  if (!isApiError(error)) return null;
  const raw = error.details?.retryAfterSeconds;
  // A non-finite or negative value is treated as absent rather than as "retry immediately".
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return Math.ceil(raw);
}

export function ConnectFlow({ resolved, token }: ConnectFlowProps): ReactElement {
  const [stage, setStage] = useState<Stage>("idle");
  const [country, setCountry] = useState("IN");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  /** One slot, for both the client-side validation message and the API's copy. */
  const [message, setMessage] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  /** True once the code in hand is dead — expired, or five wrong guesses. Resend is the only way on. */
  const [codeDead, setCodeDead] = useState(false);

  const shape = resolved.template.shape.buttonShape;
  const e164 = toE164(country, phone);

  /* The resend countdown. One timer, restarted whenever `remaining` changes, cleared on unmount —
     the same shape the sign-in screen's `ResendRow` uses. */
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  /**
   * Turn a thrown `ApiError` into what the reader sees.
   *
   * The two link-level failures are terminal: the token stopped resolving while the flow was
   * open, so there is no code to type and no point offering a resend. Everything else keeps the
   * flow alive, because everything else is something the reader can act on.
   */
  const handleFailure = useCallback((error: unknown) => {
    const screen = toScreenError(error);
    setMessage(`${screen.title}. ${screen.detail}`);

    if (!isApiError(error)) return;

    if (error.code === "SHARE_LINK_NOT_FOUND" || error.code === "SHARE_LINK_REVOKED") {
      setStage("dead");
      return;
    }

    /* A dead code and a wrong code look identical on screen unless this distinction is kept:
       `OTP_INVALID` leaves the input live so the next attempt can succeed, while these two mean
       even the correct digits are now rejected. Getting it wrong makes the retry a lie. */
    if (error.code === "OTP_NOT_FOUND" || error.code === "OTP_ATTEMPTS_EXCEEDED") {
      setCodeDead(true);
      setCode("");
    }

    // The server's own cooldown outranks ours, in both directions.
    const retryAfter = retryAfterFrom(error);
    if (retryAfter !== null) setRemaining(retryAfter);
    else if (error.code === "OTP_RATE_LIMITED") setRemaining(0); // no retry-after given; nothing to count.
  }, []);

  const requestCode = useCallback(async () => {
    const check = validatePhone(phone);
    if (!check.valid) {
      setMessage(check.message);
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      const result = await publicConnect.otpRequest(token, e164);
      setDevCode(result.devCode ?? null);
      setCodeDead(false);
      setCode("");
      setRemaining(RESEND_SECONDS);
      setStage("code");
    } catch (error) {
      handleFailure(error);
    } finally {
      setPending(false);
    }
  }, [phone, e164, token, handleFailure]);

  const verifyCode = useCallback(async () => {
    const check = validateOtp(code);
    if (!check.valid) {
      setMessage(check.message);
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      await publicConnect.otpVerify(token, e164, code);
      // Nothing to re-fetch and nowhere to go — see the module note.
      setDevCode(null);
      setStage("done");
    } catch (error) {
      handleFailure(error);
    } finally {
      setPending(false);
    }
  }, [code, e164, token, handleFailure]);

  return (
    <div
      data-connect-flow=""
      /* Published so a test can assert the stage without reverse-engineering which control is
         on screen — the same reasoning as `data-card-action-count` next door. */
      data-connect-stage={stage}
      /* Published on the root rather than only on the resend control, because a cooldown can
         land on the *first* request — before a resend control exists. */
      data-connect-remaining={remaining}
      style={{
        ...(paletteVars(resolved.palette) as CSSProperties),
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      {stage === "idle" ? (
        <CardActionButton
          action="connect"
          paletteId={resolved.palette.id}
          palette={resolved.palette}
          variant="secondary"
          surface="palette"
          shape={shape}
          icon={<UserPlus size={16} strokeWidth={1.75} />}
          onClick={() => {
            setMessage(null);
            setStage("phone");
          }}
        >
          Save &amp; connect
        </CardActionButton>
      ) : null}

      {stage === "phone" ? (
        <Panel
          /* First name only, possessive. `fullName` is never empty on a card that rendered
             (the page refuses a payload with neither a name nor a field), but `split` is
             typed as possibly-undefined, so the fallback keeps the sentence grammatical
             rather than printing "Get 's card". */
          title={`Get ${resolved.fullName.split(" ")[0] ?? "their"}'s card as a live link`}
          helper="We'll send a 6-digit code to your WhatsApp. No account, no password."
        >
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <select
              aria-label="Country dialling code"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              disabled={pending}
              style={{ ...fieldStyle, flex: "0 0 auto", width: "7.5rem" }}
            >
              {COUNTRIES.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.code} {entry.dial}
                </option>
              ))}
            </select>
            <input
              aria-label="Your phone number"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={phone}
              /* Filtered on the way in, so what can be typed and what `validatePhone` accepts
                 cannot drift — the reason `digitsOnly` is exported at all. */
              onChange={(event) => setPhone(digitsOnly(event.target.value))}
              disabled={pending}
              style={{ ...fieldStyle, flex: "1 1 auto", minWidth: 0 }}
            />
          </div>

          {/* ⚠ The cooldown is enforced here as well as on the resend, and it has to be.
              `OTP_COOLDOWN` is reachable on the **first** request of this flow — the scanner
              may have asked for a code minutes ago, on this card or another one, since the
              limit is per phone and not per card. Leaving this control enabled then showed
              "Give it a moment" above a button that invited the identical failure, with the
              server's own `retryAfterSeconds` held in state and never rendered. */}
          <CardActionButton
            action="connect-send-code"
            paletteId={resolved.palette.id}
            palette={resolved.palette}
            variant="primary"
            surface="palette"
            shape={shape}
            onClick={() => void requestCode()}
            disabled={pending || remaining > 0}
            busy={pending}
          >
            {pending
              ? "Sending…"
              : remaining > 0
                ? `Send code in ${remaining}s`
                : "Send code"}
          </CardActionButton>
        </Panel>
      ) : null}

      {stage === "code" ? (
        <Panel title="Enter the code" helper={`Six digits, sent on WhatsApp to ${e164}.`}>
          <input
            aria-label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(event) => setCode(digitsOnly(event.target.value).slice(0, 6))}
            disabled={pending}
            style={{ ...fieldStyle, letterSpacing: "0.35em", textAlign: "center" }}
          />

          {/* The server returned the code instead of sending it — staging with Twilio unconfigured.
              Labelled plainly so it reads as a deliberate affordance, not a leak. */}
          {devCode === null ? null : (
            <p data-connect-dev-code={devCode} style={{ ...helperStyle, fontFamily: "monospace" }}>
              Staging: no WhatsApp message was sent. Your code is {devCode}.
            </p>
          )}

          <CardActionButton
            action="connect-verify"
            paletteId={resolved.palette.id}
            palette={resolved.palette}
            variant="primary"
            surface="palette"
            shape={shape}
            onClick={() => void verifyCode()}
            /* A dead code cannot be verified at any speed, so the control says so rather than
               offering a request that is certain to fail. */
            disabled={pending || codeDead}
            busy={pending}
          >
            {pending ? "Checking…" : codeDead ? "Ask for a new code" : "Verify & connect"}
          </CardActionButton>

          <button
            type="button"
            data-connect-resend=""
            data-resend-remaining={remaining}
            onClick={() => void requestCode()}
            disabled={pending || remaining > 0}
            style={{
              ...linkStyle,
              cursor: pending || remaining > 0 ? "not-allowed" : "pointer",
              opacity: pending || remaining > 0 ? 0.55 : 1,
            }}
          >
            {remaining > 0 ? `Resend code in ${remaining}s` : "Resend code"}
          </button>
        </Panel>
      ) : null}

      {stage === "done" ? (
        <Panel
          title="You're connected"
          /* "Shortly" and not "now": the copy goes out through the Postgres outbox, so a
             delivery promise here would be a claim this page cannot keep. */
          helper={`${resolved.fullName} can now keep this card up to date for you. Your own copy of the link is on its way over WhatsApp.`}
          icon={<Check size={16} strokeWidth={2} />}
        />
      ) : null}

      {stage === "dead" ? (
        <Panel title="This card is no longer available" helper="Ask for a fresh link." />
      ) : null}

      {/* One slot, announced when it changes. `role="status"` rather than `alert`: every message
          this flow produces is something to read and act on, not an interruption. */}
      {message === null ? null : (
        <p role="status" data-connect-message="" style={{ ...helperStyle, color: "var(--c-ink)" }}>
          {message}
        </p>
      )}
    </div>
  );
}

/* ── the panel and its three styles ──────────────────────────────────────────────────── */

const fieldStyle: CSSProperties = {
  minHeight: "44px", // the same thumb-sized floor `CardActionButton` uses
  paddingInline: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  /* The alt-button pair, not the ground: an input painted `--c-ground` on a `--c-ground` panel
     has no edge, and the alt pair is the one already proven legible against this palette. */
  background: "var(--c-button-alt-bg)",
  color: "var(--c-button-alt-ink)",
  border: "1px solid var(--c-button-alt-border)",
  fontSize: "var(--text-sm)",
  width: "100%",
};

const helperStyle: CSSProperties = {
  margin: 0,
  fontSize: "var(--text-xs)",
  lineHeight: 1.5,
  color: "var(--c-ink-soft)",
};

const linkStyle: CSSProperties = {
  alignSelf: "center",
  background: "none",
  border: "none",
  padding: "var(--space-1) var(--space-2)",
  color: "var(--c-ink-soft)",
  fontSize: "var(--text-xs)",
  textDecoration: "underline",
};

/** A titled group on the palette ground. Borderless — the gap does the separating. */
function Panel({
  title,
  helper,
  icon,
  children,
}: {
  title: string;
  helper: string;
  icon?: ReactElement;
  children?: ReactNode;
}): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <p
          style={{
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-medium)",
            color: "var(--c-ink)",
          }}
        >
          {icon === undefined ? null : <span aria-hidden="true">{icon}</span>}
          {title}
        </p>
        <p style={helperStyle}>{helper}</p>
      </div>
      {children}
    </div>
  );
}

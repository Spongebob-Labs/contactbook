"use client";

import { useCallback, useState, type CSSProperties, type ReactElement } from "react";

import { Check, Smartphone } from "lucide-react";

import { CardActionButton } from "@/card/card-action-button";
import { paletteVars } from "@/card/template-palettes";
import { INK, Panel, fieldStyle, helperStyle } from "@/components/public-card/connect-panel";
import { publicConnect } from "@/lib/api/browser";
import { isApiError, toScreenError } from "@/lib/api/errors";
import { digitsOnly, validatePhone } from "@/lib/auth-validation";
import { COUNTRIES, toE164 } from "@/lib/countries";
import type { ResolvedCard } from "@/types/domain";

/**
 * "Send to my phone" — the scanner types a number and the card goes to it over WhatsApp. One
 * request, `POST /public/links/{token}/connect/send`, and no code.
 *
 * ## What it replaced, and what that trade is
 * `connect-flow.tsx` ("Save & connect") reaches the same outcome — a contact on the owner's side,
 * a live `ShareLink`, the link sent over WhatsApp — but only after a WhatsApp OTP proves the
 * number is the scanner's. Product chose zero friction over that proof (2026-09-23), so this is
 * what the page renders now. `ConnectFlow` is kept, unwired, so going back is a one-line swap in
 * `public-card-client.tsx`.
 *
 * ⚠ **Nothing here proves the number is the scanner's.** A typo sends the owner's card to a
 * stranger and adds that stranger to the owner's contacts. Two consequences for this component:
 * the copy never implies a check happened, and the success state repeats the number back so a
 * typo is visible at the one moment it can still be noticed. The API logs these connects under
 * their own source (`SEND_TO_PHONE`) and does not rate-limit them.
 *
 * ## Why so much of `ConnectFlow` is missing
 * No code step, no dev code, no resend timer, no cooldown. `/connect/send` never touches
 * `OtpService`, so none of the `OTP_*` failures that state exists to handle can happen here.
 * What can go wrong is: the token died (terminal, same as `ConnectFlow`), the number is the
 * owner's own, or the request failed for a reason the envelope explains.
 *
 * ## Same shape as `ConnectFlow` otherwise
 * Inline in the actions tier, no modal, no navigation and no re-fetch on success: the card on
 * screen was resolved from live data and connecting changes nothing about it. A deliberate tap,
 * never an effect on page load. Palette vars throughout, re-applied on the root because this
 * subtree is not guaranteed to sit inside a card root.
 */

/** `done` is terminal; `dead` is a token that stopped resolving while the flow was open. */
type Stage = "idle" | "phone" | "done" | "dead";

export interface ConnectSendFlowProps {
  resolved: ResolvedCard;
  /** The share token from `/c/{token}`, passed down rather than re-read from the URL. */
  token: string;
}

export function ConnectSendFlow({ resolved, token }: ConnectSendFlowProps): ReactElement {
  const [stage, setStage] = useState<Stage>("idle");
  const [country, setCountry] = useState("IN");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  /** One slot, for both the client-side validation message and the API's copy. */
  const [message, setMessage] = useState<string | null>(null);

  const shape = resolved.template.shape.buttonShape;
  const e164 = toE164(country, phone);

  /* ⚠ `fullName` can legitimately be `""` (see the same guard in `ConnectFlow`), so neither
     sentence interpolates it raw — the nameless case drops the possessive instead of producing
     "Get 's card". */
  const ownerName = resolved.fullName.trim();
  const firstName = ownerName.split(" ")[0] ?? "";
  const askTitle =
    firstName.length > 0 ? `Get ${firstName}'s card on WhatsApp` : "Get this card on WhatsApp";
  /* "Sending", not "sent": the message goes out through the Postgres outbox, so a 200 here means
     it is queued, not delivered. A delivery claim would be a promise this page cannot keep. */
  const doneTitle =
    firstName.length > 0
      ? `We're sending ${firstName}'s card to your WhatsApp`
      : "We're sending this card to your WhatsApp";
  const doneHelper =
    `It's going to ${e164} and should arrive in a moment. ` +
    `${ownerName.length > 0 ? ownerName : "The owner"} can keep it up to date for you from now on.`;

  const sendCard = useCallback(async () => {
    const check = validatePhone(phone);
    if (!check.valid) {
      setMessage(check.message);
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      await publicConnect.send(token, e164);
      // Nothing to re-fetch and nowhere to go — see the module note.
      setStage("done");
    } catch (error) {
      const screen = toScreenError(error);
      setMessage(`${screen.title}. ${screen.detail}`);
      /* The token stopped resolving while the flow was open. Terminal: there is no number that
         would work now. Everything else — the owner's own number, a failed request — leaves the
         input live, because the reader can act on it. */
      if (
        isApiError(error) &&
        (error.code === "SHARE_LINK_NOT_FOUND" || error.code === "SHARE_LINK_REVOKED")
      ) {
        setStage("dead");
      }
    } finally {
      setPending(false);
    }
  }, [phone, e164, token]);

  return (
    <div
      data-connect-flow=""
      /* Which of the two connect paths is on the page — `ConnectFlow` publishes `otp`. */
      data-connect-mode="send"
      data-connect-stage={stage}
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
          surface="canvas"
          shape={shape}
          icon={<Smartphone size={16} strokeWidth={1.75} />}
          onClick={() => {
            setMessage(null);
            setStage("phone");
          }}
        >
          Send to my phone
        </CardActionButton>
      ) : null}

      {stage === "phone" ? (
        <Panel
          title={askTitle}
          /* Says plainly that nothing is checked, and asks the reader to do the checking — the
             only safeguard against a typo on this path is the person typing. */
          helper="We'll message this number on WhatsApp right away, so make sure it's yours. No account, no code."
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
                 cannot drift. */
              onChange={(event) => setPhone(digitsOnly(event.target.value))}
              disabled={pending}
              style={{ ...fieldStyle, flex: "1 1 auto", minWidth: 0 }}
            />
          </div>

          <CardActionButton
            action="connect-send"
            paletteId={resolved.palette.id}
            palette={resolved.palette}
            variant="primary"
            surface="canvas"
            shape={shape}
            onClick={() => void sendCard()}
            disabled={pending}
            busy={pending}
          >
            {pending ? "Sending…" : "Send"}
          </CardActionButton>
        </Panel>
      ) : null}

      {stage === "done" ? (
        <Panel title={doneTitle} helper={doneHelper} icon={<Check size={16} strokeWidth={2} />} />
      ) : null}

      {stage === "dead" ? (
        <Panel title="This card is no longer available" helper="Ask for a fresh link." />
      ) : null}

      {/* `role="status"` rather than `alert`: every message here is something to read and act
          on, not an interruption. */}
      {message === null ? null : (
        <p role="status" data-connect-message="" style={{ ...helperStyle, color: INK }}>
          {message}
        </p>
      )}
    </div>
  );
}

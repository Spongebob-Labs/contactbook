"use client";

import { Check, CircleAlert, MessageCircle } from "lucide-react";
import {
  useId,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
  type Ref,
} from "react";

import { CountrySelect } from "@/components/auth/country-select";
import { Button, buttonClassName } from "@/components/primitives/button";
import { Input } from "@/components/primitives/input";
import { Select } from "@/components/primitives/select";
import { shareCardWith, type MintedLink } from "@/components/share/card-sharing";
import { LinkField } from "@/components/share/card-link-block";
import { whatsappShareHref } from "@/components/share/share-sheet";
import { toScreenError } from "@/lib/api/errors";
import { MAX_PHONE_DIGITS, MIN_PHONE_DIGITS, digitsOnly } from "@/lib/auth-validation";
import { cn } from "@/lib/cn";
import { normaliseE164 } from "@/lib/contacts-parse";
import { COUNTRIES, dialCodeFor, dialPrefixOf, toE164 } from "@/lib/countries";
import { formatPhoneDisplay } from "@/lib/format";
import { useOptionalSession } from "@/lib/session-context";
import type { Contact } from "@/types/domain";

/**
 * **Send a card to a phone number** — the primary share action, built once and used twice:
 * block (b) on `/cards/[cardId]` and the whole of the `/share` quick-share screen.
 *
 * Client review, 2026-09-28: *"Phone number entry should be the primary share method."* So the
 * number is the first field, with the country code beside it, and the one button sends on
 * WhatsApp. Picking an existing contact is still possible, one tap away, because the same two
 * calls serve both.
 *
 * ## What one press does
 * `POST /contacts` (upsert — this is what adds the person to your contacts) →
 * `POST /cards/{id}/share {contactId}` (mints or reuses the per-person link and writes the
 * WhatsApp send to the outbox). Both live in `shareCardWith`. Nothing here calls Twilio.
 *
 * ## Three outcomes, shown in place of the form
 * · **Sent** — "Sent to {name or number}", their link with Copy, and "Send to someone else".
 * · **Not sent** (`CARD_SHARE_TEMPLATE_NOT_CONFIGURED`) — said plainly, with a one-tap `wa.me`
 *   link aimed at *that* number and pre-filled with *their* link, so the owner can send it.
 * · **Failed** — the API's error, in words, under the button; the form keeps what was typed.
 *
 * The result replaces the form rather than toasting, because it carries a link the owner may
 * need to copy — a toast that disappears in six seconds is the wrong place for that.
 *
 * ## The number
 * National digits in the field, the country in a select, joined by `toE164` (which drops a
 * trunk `0`). A paste that starts with `+` is split back into country and digits, so pasting
 * `+44 7979 080009` from a contact just works. The number is never logged; it leaves only in
 * the request body.
 */

export interface SendCardOption {
  id: string;
  name: string;
}

/** What a parent can ask of the block — the header's Share button calls `focus()`. */
export interface SendToPhoneHandle {
  focus: () => void;
}

export interface SendToPhoneProps {
  /**
   * The cards this block can send. One card: no picker (the card page). More than one: a
   * "Card" select after the number (the quick-share screen).
   */
  cards: readonly SendCardOption[];
  /** Which card is selected first. Defaults to the first in `cards`. */
  defaultCardId?: string;
  /** The owner's registry, for "Choose from contacts". Empty hides that option. */
  contacts: readonly Contact[];
  /** Whether `contactId` already holds `cardId` — decides the "Same link as before." line. */
  alreadySent?: (cardId: string, contactId: string) => boolean;
  /** Called after every send that produced a link, including the not-delivered one. */
  onSent?: (minted: MintedLink, cardId: string) => void;
  /** The block's heading. Omitted on a screen whose page title already says it. */
  title?: ReactNode;
  /** Shown above the form — the card page uses it for "this card has no fields yet". */
  notice?: ReactNode;
  /** Focus the number field on mount. Only for a screen that exists to type a number. */
  autoFocus?: boolean;
  ref?: Ref<SendToPhoneHandle>;
  className?: string;
}

type Mode = "number" | "contact";

interface Outcome {
  minted: MintedLink;
  cardName: string;
  /** The recipient came from a typed number, so the upsert just put them in contacts. */
  viaNumber: boolean;
  /** They already held this card, so the same link went out again. */
  resent: boolean;
}

/** `"+91"` → `"IN"`. Keeps `current` when it already has that code, so +1 does not flip CA↔US. */
function countryForDial(dial: string, current?: string): string | null {
  if (current !== undefined && dialCodeFor(current) === dial) return current;
  if (dial === "+1") return "US";
  return COUNTRIES.find((country) => country.dial === dial)?.code ?? null;
}

const FALLBACK_COUNTRY = "IN";

/** A local fact, so it is decided before any round trip. `null` means the number is usable. */
function numberProblem(country: string, digits: string): string | null {
  if (digits.length === 0) return "Enter a phone number.";
  const national = digits.replace(/^0+/, "");
  if (national.length < MIN_PHONE_DIGITS) return "That number looks too short.";
  // E.164 caps the WHOLE number, country code included, at 15 digits.
  if (toE164(country, digits).length - 1 > MAX_PHONE_DIGITS) return "That number is too long.";
  return null;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function SendToPhone({
  cards,
  defaultCardId,
  contacts,
  alreadySent,
  onSent,
  title,
  notice,
  autoFocus = false,
  ref,
  className,
}: SendToPhoneProps) {
  const session = useOptionalSession();
  const ownCountry =
    session?.user == null ? null : countryForDial(session.user.countryCode);

  const [mode, setMode] = useState<Mode>("number");
  const [country, setCountry] = useState<string>(ownCountry ?? FALLBACK_COUNTRY);
  const [digits, setDigits] = useState("");
  const [name, setName] = useState("");
  const [contactId, setContactId] = useState("");
  const [cardId, setCardId] = useState<string>(
    defaultCardId !== undefined && cards.some((card) => card.id === defaultCardId)
      ? defaultCardId
      : (cards[0]?.id ?? ""),
  );
  const [numberError, setNumberError] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, startTransition] = useTransition();

  const root = useRef<HTMLElement>(null);
  const numberInput = useRef<HTMLInputElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  const headingId = useId();

  const card = cards.find((option) => option.id === cardId) ?? null;
  const selectedContact = contacts.find((contact) => contact.id === contactId) ?? null;
  const optedOut = mode === "contact" && selectedContact !== null && selectedContact.optedOutAt !== null;

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        root.current?.scrollIntoView({
          block: "center",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
        if (outcome !== null) {
          resultHeading.current?.focus({ preventScroll: true });
        } else if (mode === "number") {
          numberInput.current?.focus({ preventScroll: true });
        } else {
          root.current
            ?.querySelector<HTMLElement>("[data-send-contact-picker] button")
            ?.focus({ preventScroll: true });
        }
      },
    }),
    [mode, outcome],
  );

  function changeNumber(raw: string) {
    setNumberError(null);
    setFailure(null);
    /* A pasted international number carries its own country. Split it back into the two
       controls rather than rejecting the `+` or doubling the code. */
    if (raw.trim().startsWith("+")) {
      const e164 = normaliseE164(raw);
      const dial = e164 === null ? "" : dialPrefixOf(e164);
      const iso = dial === "" ? null : countryForDial(dial, country);
      if (e164 !== null && iso !== null) {
        setCountry(iso);
        setDigits(e164.slice(dial.length).slice(0, MAX_PHONE_DIGITS));
        return;
      }
    }
    setDigits(digitsOnly(raw).slice(0, MAX_PHONE_DIGITS));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (card === null || pending) return;
    setFailure(null);

    let target: Parameters<typeof shareCardWith>[1];
    if (mode === "number") {
      const problem = numberProblem(country, digits);
      if (problem !== null) {
        setNumberError(problem);
        numberInput.current?.focus();
        return;
      }
      target = { phoneE164: toE164(country, digits), displayName: name };
    } else {
      if (contactId.length === 0) {
        setFailure({ title: "Choose who to send it to." });
        return;
      }
      target = { contactId };
    }

    const sending = card;
    startTransition(async () => {
      try {
        const minted = await shareCardWith(sending.id, target);
        setOutcome({
          minted,
          cardName: sending.name,
          viaNumber: mode === "number",
          resent: alreadySent?.(sending.id, minted.contactId) ?? false,
        });
        onSent?.(minted, sending.id);
        // After the result has painted, so the heading exists to take focus.
        window.requestAnimationFrame(() => resultHeading.current?.focus());
      } catch (thrown) {
        const shown = toScreenError(thrown);
        setFailure({ title: shown.title, detail: shown.detail });
      }
    });
  }

  function sendAnother() {
    setOutcome(null);
    setDigits("");
    setName("");
    setContactId("");
    setNumberError(null);
    setFailure(null);
    window.requestAnimationFrame(() => numberInput.current?.focus());
    setMode("number");
  }

  return (
    <section
      ref={root}
      data-send-to-phone=""
      data-send-state={outcome === null ? "form" : outcome.minted.templateMissing ? "not-sent" : "sent"}
      aria-labelledby={title === undefined ? undefined : headingId}
      aria-label={title === undefined ? "Send a card" : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-5 rounded-lg border border-line bg-canvas p-4 sm:p-6",
        className,
      )}
    >
      {title === undefined ? null : (
        <h2 id={headingId} className="text-h3 text-ink">
          {title}
        </h2>
      )}

      {notice}

      {outcome === null ? (
        <form noValidate onSubmit={submit} className="flex min-w-0 flex-col gap-4">
          {mode === "number" ? (
            <>
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="mb-2 text-sm font-medium text-ink">
                  Phone number
                </legend>
                <div className="flex min-w-0 items-start gap-2">
                  <CountrySelect
                    value={country}
                    onValueChange={(code) => {
                      setCountry(code);
                      setNumberError(null);
                    }}
                    className="w-32 shrink-0 sm:w-44"
                  />
                  <Input
                    ref={numberInput}
                    label="Number"
                    hideLabel
                    data-send-phone=""
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    /* The owner is typing SOMEONE ELSE's number: `tel` would offer their own. */
                    autoFocus={autoFocus}
                    /* An example only where it is the right shape; a UK number under an
                       Indian example reads as a mistake. */
                    placeholder={country === "IN" ? "98200 00000" : undefined}
                    value={digits}
                    error={numberError}
                    onChange={(event) => changeNumber(event.target.value)}
                    fieldClassName="min-w-0 flex-1"
                  />
                </div>
              </fieldset>

              <Input
                label="Name"
                data-send-name=""
                autoComplete="off"
                placeholder="Optional"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </>
          ) : (
            <div data-send-contact-picker="">
              <Select
                label="Contact"
                value={contactId}
                placeholder="Choose a contact"
                onValueChange={(value) => {
                  setContactId(value);
                  setFailure(null);
                }}
                items={contacts.map((contact) => ({
                  value: contact.id,
                  /* The number is in the label because two people can share a name, and picking
                     the wrong row sends a card to a stranger. Written once for an unnamed one. */
                  label:
                    contact.displayName !== null && contact.displayName.trim().length > 0
                      ? `${contact.displayName.trim()} · ${formatPhoneDisplay(contact.phoneE164)}`
                      : formatPhoneDisplay(contact.phoneE164),
                }))}
              />
            </div>
          )}

          {cards.length > 1 ? (
            <div data-send-card-picker="">
              <Select
                label="Card"
                value={cardId}
                onValueChange={setCardId}
                items={cards.map((option) => ({ value: option.id, label: option.name }))}
              />
            </div>
          ) : null}

          {optedOut ? (
            <p data-send-opted-out="" className="text-sm text-warning-ink">
              They opted out of WhatsApp messages. The link is still made, but nothing is
              delivered.
            </p>
          ) : null}

          {failure === null ? null : (
            <div role="alert" data-send-error="" className="text-sm text-danger">
              <p className="font-medium">{failure.title}</p>
              {failure.detail === undefined ? null : <p>{failure.detail}</p>}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <Button
              type="submit"
              data-send-card=""
              loading={pending}
              loadingLabel="Sending…"
              disabled={card === null}
              disabledReason={card === null ? "You have no card to send yet." : undefined}
              className="w-full sm:w-auto"
            >
              <MessageCircle aria-hidden="true" size={16} strokeWidth={1.75} />
              Send on WhatsApp
            </Button>

            {contacts.length === 0 ? null : (
              <Button
                variant="text-link"
                data-send-mode-toggle={mode === "number" ? "contact" : "number"}
                className="self-start sm:self-auto"
                onClick={() => {
                  setMode(mode === "number" ? "contact" : "number");
                  setNumberError(null);
                  setFailure(null);
                }}
              >
                {mode === "number" ? "Choose from contacts" : "Type a number instead"}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <SendResult
          outcome={outcome}
          namedCard={cards.length > 1}
          headingRef={resultHeading}
          onSendAnother={sendAnother}
        />
      )}
    </section>
  );
}

function SendResult({
  outcome,
  namedCard,
  headingRef,
  onSendAnother,
}: {
  outcome: Outcome;
  /** Whether the owner chose between cards, so the result should say which one went. */
  namedCard: boolean;
  headingRef: Ref<HTMLHeadingElement>;
  onSendAnother: () => void;
}) {
  const { minted, cardName, viaNumber, resent } = outcome;
  const who = minted.recipientLabel;

  if (minted.templateMissing) {
    return (
      <div data-send-result="not-sent" className="flex min-w-0 flex-col gap-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-warning-wash text-warning-ink"
          >
            <CircleAlert size={14} strokeWidth={2} />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h3
              ref={headingRef}
              tabIndex={-1}
              className="text-base font-medium text-ink outline-none"
            >
              {`Not sent to ${who}`}
            </h3>
            <p className="text-sm text-ink-2">
              WhatsApp sending isn&apos;t switched on yet, so no message went out. Their link is
              ready. Send it from your own WhatsApp.
            </p>
          </div>
        </div>

        <a
          href={whatsappShareHref(minted.recipientPhoneE164, cardName, minted.url)}
          target="_blank"
          rel="noopener noreferrer"
          data-send-fallback-whatsapp=""
          className={buttonClassName({ className: "w-full sm:w-auto sm:self-start" })}
        >
          <MessageCircle aria-hidden="true" size={16} strokeWidth={1.75} />
          Open WhatsApp
        </a>

        <LinkField url={minted.url} label={`${who}'s link`} copyVariant="secondary" />

        <div>
          <Button variant="text-link" data-send-another="" onClick={onSendAnother}>
            Send to someone else
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-send-result="sent" className="flex min-w-0 flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink"
        >
          <Check size={14} strokeWidth={2.25} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 ref={headingRef} tabIndex={-1} className="text-base font-medium text-ink outline-none">
            {`Sent to ${who}`}
          </h3>
          <p className="text-sm text-ink-3">
            {[
              resent ? "Same link as before." : null,
              /* On `/share` the owner picked the card a moment ago; name it, so a wrong pick is
                 caught here rather than by the recipient. */
              namedCard ? `Your ${cardName} card is on its way over WhatsApp.` : "On its way over WhatsApp.",
              viaNumber && !resent ? "Saved to your contacts." : null,
            ]
              .filter((part) => part !== null)
              .join(" ")}
          </p>
        </div>
      </div>

      <LinkField url={minted.url} label={`${who}'s link`} copyVariant="secondary" />

      <div>
        <Button variant="text-link" data-send-another="" onClick={onSendAnother}>
          Send to someone else
        </Button>
      </div>
    </div>
  );
}

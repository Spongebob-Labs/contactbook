"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ReactElement } from "react";

import {
  EmptyState,
  ErrorPanel,
  LoadingSkeleton,
  NotFoundPanel,
  ScreenStateRoot,
  resolveDataScreenState,
} from "@/components/data";
import { useToast } from "@/components/overlay";
import { Avatar } from "@/components/primitives/avatar";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/input";
import { Skeleton } from "@/components/primitives/skeleton";
import { TextArea } from "@/components/primitives/textarea";
import { contacts as api } from "@/lib/api/browser";
import { fetchContactDetail } from "@/lib/api/browser-loaders";
import { toScreenError } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { formatLongDate, formatPhoneDisplay } from "@/lib/format";
import { useApiResource } from "@/lib/use-api";
import {
  contactLabel,
  type Contact,
  type ContactShare,
  type ContactSource,
  type FixtureError,
} from "@/types/domain";

/**
 * `/contacts/[contactId]` — one recipient (spec §6.1 R-15, §8D.3, §4.6, plan T24).
 *
 * ## ⚠ Inverted with the model
 * This screen used to render somebody else's details: the job title, company and email captured
 * when they scanned a card, grouped through `<FieldList>` and masked by field type.
 *
 * The API knows none of that. What it knows is a number, a name you chose, a private note you
 * wrote, and — joined from `GET /share-links` — **which of your cards you have sent them and
 * whether they opened it**. So the right half of the screen is no longer their details; it is the
 * history of what you have sent, which is the only relationship the broadcast model has.
 *
 * The masking rules that used to land here are gone with the fields they applied to. Nothing on
 * this screen is sensitive: a number you typed and a note you wrote are both already yours.
 *
 * ## The states, per §8D.3's contact-detail row
 * | `?state=` | screen state | what renders |
 * |---|---|---|
 * | — | `success` | identity + notes + the send history |
 * | `loading` | `loading` | identity bones + row bones |
 * | `empty` | `empty` | **the not-found panel** — an id with nothing behind it is not "you have
 *   no contacts", and it is not retryable |
 * | `error` / `offline` | `error` / `offline` | the §6.10 panel + Try again |
 *
 * `empty-filtered` is `n/a` here and `isFiltered` is not passed: there is no filter to narrow.
 */

/** Identity left, history right; stacked below `lg` (§8D.3). */
const DETAIL_GRID = "grid gap-10 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-16";

const SOURCE_LABELS: Readonly<Record<ContactSource, string>> = {
  MANUAL: "Added by you",
  IMPORTED: "Imported",
  QR_SCAN: "Scanned your card",
  INBOUND: "Messaged you",
};

export interface ContactDetailData {
  contact: Contact;
  /** Every card sent to this contact, newest first. */
  shares: ContactShare[];
}

/**
 * The way back to the list.
 *
 * It lives in this module rather than a file of its own because `page.tsx` and `loading.tsx` both
 * render it. The arrow is `aria-hidden` decoration; the words are the link's accessible name.
 */
export function ContactBackLink(): ReactElement {
  return (
    <Link
      href="/contacts"
      data-contact-back=""
      /* 44px on touch — this is the only way back from a contact on a phone, and at
         `--text-sm` it is a 20px line box. The negative margin keeps the header's spacing. */
      className={cn(
        "inline-flex w-fit items-center gap-2 text-sm text-ink-3 underline-offset-4",
        "hover:text-ink hover:underline",
        "max-md:-my-3 max-md:py-3",
      )}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to contacts
    </Link>
  );
}

/* ── the loading family (§8D.1: layout-matched skeletons, never a spinner) ─────────── */

function DetailBones(): ReactElement {
  return (
    <>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <Skeleton variant="circle" className="size-24" />
        <Skeleton className="h-9 w-56 rounded-sm" />
        <Skeleton className="h-3 w-40 rounded-xs" />
      </div>
      <LoadingSkeleton variant="fields" count={4} label="Loading this contact" />
    </>
  );
}

export function ContactDetailSkeleton(): ReactElement {
  return (
    <ScreenStateRoot
      state="loading"
      as="section"
      aria-label="Contact"
      data-contact-detail=""
      className={DETAIL_GRID}
    >
      <DetailBones />
    </ScreenStateRoot>
  );
}

/* ── the send history ─────────────────────────────────────────────────────────────────── */

/**
 * One card you have sent this contact.
 *
 * `viewCount` and `lastViewedAt` are the closest thing the API has to analytics, and on this
 * screen they are the whole point of the broadcast model: whether the link you sent was opened.
 *
 * A `REVOKED` link is shown rather than hidden. It is a thing that happened, the public URL now
 * 410s, and restoring reuses the same token — so hiding it would make a reversible act look
 * permanent.
 */
function ShareRow({ share }: { share: ContactShare }) {
  const { toast } = useToast();

  return (
    <li
      data-contact-share={share.shareLinkId}
      data-share-status={share.status}
      className="flex flex-col gap-2 border-b border-line py-4 last:border-b-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex min-w-0 items-baseline gap-2 text-base text-ink">
          <Link
            href={`/cards/${share.cardId}`}
            /* 44px on touch. Each of these is a link to a card this contact holds — the row's
               only action — and a 24px line box is under the floor. */
            className={cn(
              "min-w-0 truncate underline-offset-4 hover:underline",
              "max-md:-my-2.5 max-md:py-2.5",
            )}
          >
            {share.cardName}
          </Link>
          {share.status === "REVOKED" ? (
            <Badge tone="neutral" data-share-revoked={share.shareLinkId}>
              Revoked
            </Badge>
          ) : null}
        </p>

        <span data-share-views={share.shareLinkId} className="text-xs text-ink-3 tabular-nums">
          {share.viewCount === 0
            ? "Not opened yet"
            : `Opened ${share.viewCount} ${share.viewCount === 1 ? "time" : "times"}`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
        <span>
          {"Sent "}
          <time dateTime={share.createdAt}>{formatLongDate(share.createdAt)}</time>
        </span>
        {share.lastViewedAt === null ? null : (
          <span>
            {"Last opened "}
            <time dateTime={share.lastViewedAt}>{formatLongDate(share.lastViewedAt)}</time>
          </span>
        )}

        {/* The link is live and resolves against the current card, so copying it is a real
            fallback for when the WhatsApp send has not gone out. */}
        <Button
          variant="text-link"
          data-share-copy={share.shareLinkId}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(share.url)
              .then(() => toast({ title: "Link copied" }))
              .catch(() =>
                toast({
                  title: "We couldn't copy that",
                  description: "Select the link and copy it by hand.",
                  tone: "danger",
                }),
              );
          }}
        >
          Copy link
        </Button>
      </div>
    </li>
  );
}

/* ── the screen ───────────────────────────────────────────────────────────────────── */

export function ContactDetailClient({ contactId }: { contactId: string }): ReactElement {
  // `useCallback` because `useApiResource` re-runs whenever the loader's identity changes — an
  // inline arrow would refetch forever.
  const load = useCallback(() => fetchContactDetail(contactId)(), [contactId]);
  // `?state=empty` on this route means "no such contact", which is the not-found panel — so the
  // empty transform drops the record rather than emptying a collection inside it.
  const result = useApiResource<ContactDetailData | null>(load, () => null);
  return (
    <ContactDetailScreen
      key={result.state}
      contactId={contactId}
      state={result.state}
      data={result.data ?? null}
      error={result.error}
      reload={result.reload}
    />
  );
}

function ContactDetailScreen({
  contactId,
  state,
  data,
  error,
  reload,
}: {
  contactId: string;
  state: string;
  data: ContactDetailData | null;
  error: FixtureError | null;
  reload: () => void;
}): ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  const contact = data?.contact ?? null;
  const shares = data?.shares ?? [];

  // `isEmpty` is about the *contact*, not its history: a contact you have never sent anything to
  // still exists and still renders. `isFiltered` is omitted — no filter on this screen.
  const screenState = resolveDataScreenState({
    state: state as never,
    isEmpty: contact === null,
  });

  function save(patch: { displayName: string; notes: string }) {
    startTransition(async () => {
      try {
        // Empty strings rather than omitted keys: `PATCH /contacts/{id}` treats an absent key as
        // "leave it alone", so clearing a name has to be explicit or it silently does nothing.
        await api.update(contactId, {
          displayName: patch.displayName.trim(),
          notes: patch.notes.trim(),
        });
        toast({ title: "Contact updated" });
        setEditing(false);
      } catch (thrown) {
        const shown = toScreenError(thrown);
        toast({ title: shown.title, description: shown.detail, tone: "danger" });
      }
      reload();
    });
  }

  let body: ReactElement;
  if (screenState === "loading") {
    body = <DetailBones />;
  } else if (screenState === "error" || screenState === "offline") {
    body = (
      <div className="lg:col-span-2">
        <ErrorPanel
          error={error}
          title="We couldn't load this contact"
          headingLevel={1}
          onRetry={reload}
          homeHref="/contacts"
          homeLabel="Go to contacts"
        />
      </div>
    );
  } else if (screenState === "empty" || contact === null) {
    body = (
      <div className="lg:col-span-2">
        {/* §8D.3: the contact-detail empty IS the not-found panel. `NotFoundPanel` has no
            `onRetry` prop at all — retrying an id that resolves to nothing fails again, so the
            affordance does not exist rather than being merely discouraged. */}
        <NotFoundPanel
          headingLevel={1}
          title="We couldn't find that contact"
          backHref="/contacts"
          backLabel="Go to contacts"
        />
      </div>
    );
  } else {
    body = (
      <>
        <div className="flex flex-col items-start gap-4">
          {/* Always the monogram: the API stores no photo for a contact, only for the owner. */}
          <Avatar name={contactLabel(contact)} size="xl" />

          <h1 data-contact-name="" className="text-h2 text-ink">
            {contactLabel(contact)}
          </h1>

          {contact.optedOutAt !== null ? (
            <div className="flex flex-col gap-1">
              <Badge tone="neutral" data-contact-opted-out-badge="">
                Opted out
              </Badge>
              {/* The part that surprises people, said plainly. */}
              <p className="text-xs text-ink-3">
                {"They texted STOP on "}
                <time dateTime={contact.optedOutAt}>{formatLongDate(contact.optedOutAt)}</time>
                {", so no new cards will be sent. Links they already have keep working."}
              </p>
            </div>
          ) : null}

          <dl className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <dt className="text-xs text-ink-3">Number</dt>
              <dd data-contact-phone="" className="text-base text-ink tabular-nums">
                {formatPhoneDisplay(contact.phoneE164)}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <dt className="text-xs text-ink-3">Added</dt>
              <dd className="text-base text-ink">
                <time dateTime={contact.createdAt}>{formatLongDate(contact.createdAt)}</time>
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <dt className="text-xs text-ink-3">How</dt>
              <dd data-contact-source="" className="text-base text-ink">
                {SOURCE_LABELS[contact.source]}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-ink-3">
            The number is how a contact is matched, so it cannot be changed here.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-10">
          <section aria-labelledby="contact-notes-heading" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="contact-notes-heading" className="text-lg text-ink">
                Your note
              </h2>
              {editing ? null : (
                <Button variant="secondary" data-contact-edit="" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
            </div>

            {editing ? (
              <ContactEditForm
                contact={contact}
                busy={pending}
                onCancel={() => setEditing(false)}
                onSave={save}
              />
            ) : contact.notes === null || contact.notes.trim().length === 0 ? (
              <p data-contact-notes-empty="" data-prose className="text-base text-ink-3">
                Nothing noted yet. A note is private to you — never shown to the contact.
              </p>
            ) : (
              <p data-contact-notes="" data-prose className="text-base whitespace-pre-line text-ink">
                {contact.notes}
              </p>
            )}
          </section>

          <section aria-labelledby="contact-shares-heading" className="flex flex-col gap-3">
            <h2 id="contact-shares-heading" className="text-lg text-ink">
              Cards you have sent
            </h2>

            {shares.length === 0 ? (
              <EmptyState
                headingLevel={3}
                overline="Nothing sent yet"
                title="Send them a card"
                action={{ label: "Go to your cards", href: "/cards" }}
              />
            ) : (
              <ul data-contact-shares="" className="flex flex-col">
                {shares.map((share) => (
                  <ShareRow key={share.shareLinkId} share={share} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </>
    );
  }

  return (
    <ScreenStateRoot
      state={screenState}
      // `section`, never `main`: `AppShell` owns the single <main id="main"> and a second
      // landmark fails axe's `landmark-unique` (AC-25).
      as="section"
      aria-label="Contact"
      data-contact-detail={contactId}
      className={DETAIL_GRID}
    >
      {body}
    </ScreenStateRoot>
  );
}

/**
 * Rename, or rewrite the note.
 *
 * Both fields are sent together, and both are sent even when blank — `PATCH /contacts/{id}` takes
 * an omitted key as "leave it alone", so clearing a name has to be an explicit empty string or it
 * would silently do nothing.
 */
function ContactEditForm({
  contact,
  onSave,
  onCancel,
  busy,
}: {
  contact: Contact;
  onSave: (patch: { displayName: string; notes: string }) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [displayName, setDisplayName] = useState(contact.displayName ?? "");
  const [notes, setNotes] = useState(contact.notes ?? "");

  return (
    <form
      data-contact-edit-form=""
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ displayName, notes });
      }}
    >
      <Input
        label="Name"
        hint="Leave it blank and this contact shows as their number."
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
      />
      <TextArea
        label="Private note"
        rows={4}
        hint="Only you ever see this."
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} loadingLabel="Saving…">
          Save
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

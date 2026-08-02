import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Link2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApiError } from "@/lib/api";
import { listCards } from "@/lib/cards-api";
import {
  listConnections,
  resendConnectionRequest,
  sendConnectionRequest,
  type ConnectionListItem,
} from "@/lib/connections-api";
import { fetchContactsPage } from "@/lib/contacts-api";
import { DIAL_COUNTRIES } from "@/lib/dial-countries";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { nationalDigits } from "@/lib/phone";
import type { ContactCard, ContactDetail } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusVariant(
  status: string,
): "connected" | "danger" | "neutral" {
  if (status === "ACCEPTED") {
    return "connected";
  }
  if (status === "DECLINED") {
    return "danger";
  }
  return "neutral";
}

function connectionTitle(item: ConnectionListItem) {
  if (item.type === "invite") {
    const phone = [item.recipientCountryCode, item.recipientPhone]
      .filter(Boolean)
      .join(" ");
    return phone || "Invite";
  }
  return `Connection ${item.id.slice(0, 8)}…`;
}

export default function ConnectionsPage() {
  const [items, setItems] = useState<ConnectionListItem[]>([]);
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [contacts, setContacts] = useState<ContactDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"phone" | "contact">("phone");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [contactId, setContactId] = useState("");
  const [cardId, setCardId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [resendBusyId, setResendBusyId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [connections, cardList, contactPage] = await Promise.all([
        listConnections(),
        listCards().catch(() => [] as ContactCard[]),
        fetchContactsPage({ page: "1", limit: "100" }).catch(() => ({
          items: [] as ContactDetail[],
        })),
      ]);
      setItems(connections);
      setCards(cardList);
      setContacts(contactPage.items);
    } catch (err) {
      logUiError("Could not load connections", err);
      setItems([]);
      setError(
        err instanceof ApiError && err.message
          ? err.message
          : friendlyErrorMessages.load,
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSend = async () => {
    if (mode === "phone") {
      const national = nationalDigits(phone);
      if (!/^\+\d{1,4}$/.test(countryCode.trim())) {
        toast.error("Enter a valid country code.");
        return;
      }
      if (!/^\d{4,15}$/.test(national)) {
        toast.error("Enter a valid phone number.");
        return;
      }
    } else if (!contactId) {
      toast.error("Select a contact.");
      return;
    }

    setIsSending(true);
    try {
      const created =
        mode === "contact"
          ? await sendConnectionRequest({
              recipientContactId: contactId,
              ...(cardId ? { requesterSharedCardId: cardId } : {}),
            })
          : await sendConnectionRequest({
              recipientCountryCode: countryCode.trim(),
              recipientPhone: nationalDigits(phone),
              ...(cardId ? { requesterSharedCardId: cardId } : {}),
            });

      setItems((current) => [created, ...current]);
      setPhone("");
      setContactId("");
      toast.success(
        created.type === "invite"
          ? "Invite sent on WhatsApp."
          : "Connection request sent on WhatsApp.",
      );
    } catch (err) {
      logUiError("Could not send connection request", err);
      toast.error(
        err instanceof ApiError && err.message
          ? err.message
          : "Could not send connection request.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async (id: string) => {
    setResendBusyId(id);
    try {
      await resendConnectionRequest(id);
      toast.success("Request resent on WhatsApp.");
      await load();
    } catch (err) {
      logUiError("Could not resend connection request", err);
      toast.error(
        err instanceof ApiError && err.message
          ? err.message
          : "Could not resend this request.",
      );
    } finally {
      setResendBusyId(null);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Connections"
        subtitle="Send WhatsApp connection requests. Accept, decline, and share-back happen inside WhatsApp."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Panel className="mb-6 space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            New request
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Recipient gets a WhatsApp prompt. Optionally attach one of your cards
            to share on accept.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "phone" ? "default" : "outline"}
            disabled={isSending}
            onClick={() => setMode("phone")}
          >
            By phone
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "contact" ? "default" : "outline"}
            disabled={isSending}
            onClick={() => setMode("contact")}
          >
            By contact
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {mode === "phone" ? (
            <>
              <label className="flex flex-col gap-2 text-sm font-medium">
                <span>Country code</span>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                  disabled={isSending}
                >
                  {DIAL_COUNTRIES.map((country) => (
                    <option
                      key={`${country.iso2}-${country.dial}`}
                      value={country.dial}
                    >
                      {country.name} ({country.dial})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                <span>Phone number</span>
                <Input
                  inputMode="numeric"
                  placeholder="9347243575"
                  value={phone}
                  onChange={(event) =>
                    setPhone(nationalDigits(event.target.value).slice(0, 15))
                  }
                  disabled={isSending}
                />
              </label>
            </>
          ) : (
            <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
              <span>Contact</span>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
                disabled={isSending}
              >
                <option value="">Select a contact</option>
                {contacts.map((contact) => {
                  const label =
                    [contact.firstName, contact.lastName]
                      .filter(Boolean)
                      .join(" ") ||
                    contact.phones?.[0]?.value ||
                    contact.id;
                  return (
                    <option key={contact.id} value={contact.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
              {contacts.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  No contacts loaded. Import contacts first.
                </span>
              ) : null}
            </label>
          )}
          <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
            <span>Share card on accept (optional)</span>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
              value={cardId}
              onChange={(event) => setCardId(event.target.value)}
              disabled={isSending}
            >
              <option value="">No card</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
            {cards.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                No cards yet.{" "}
                <Link
                  to="/dashboard/cards"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Create a card
                </Link>
              </span>
            ) : null}
          </label>
        </div>
        <Button
          type="button"
          disabled={isSending}
          onClick={() => void handleSend()}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {isSending ? "Sending…" : "Send WhatsApp request"}
        </Button>
      </Panel>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : null}

      {!isLoading && error ? (
        <Alert className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 h-4 w-4 text-destructive"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">Could not load connections</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </Alert>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <Panel className="p-6 text-sm text-muted-foreground">
          No connections yet. Send a request to get started.
        </Panel>
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={`${item.type}-${item.id}`}>
              <Panel className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link2
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <h2 className="text-base font-semibold text-foreground">
                        {connectionTitle(item)}
                      </h2>
                      <StatusBadge variant={statusVariant(item.status)}>
                        {item.status}
                      </StatusBadge>
                      <StatusBadge variant="neutral">
                        {item.type === "invite" ? "Invite" : "Connection"}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Created {formatDate(item.createdAt)}
                      {item.delivery?.status
                        ? ` · delivery ${item.delivery.status}`
                        : ""}
                    </p>
                    {item.type === "connection" && item.requesterSharedCardId ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Shared card: {item.requesterSharedCardId.slice(0, 8)}…
                      </p>
                    ) : null}
                  </div>
                  {item.status === "PENDING" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={resendBusyId === item.id}
                      onClick={() => void handleResend(item.id)}
                    >
                      {resendBusyId === item.id ? "Resending…" : "Resend"}
                    </Button>
                  ) : null}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      ) : null}
    </AppShell>
  );
}

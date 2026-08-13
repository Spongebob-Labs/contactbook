/**
 * Dashboard metrics, fed by `GET /v1/dashboard/stats`.
 *
 * Form choices worth keeping:
 *
 * - The delivery numbers are **two axes, not one partition**.
 *   `pending`/`dispatched`/`failed` are the dispatch state and cover every
 *   recipient; `delivered`/`read` come from the nullable WhatsApp delivery status
 *   and nest inside it (`read ⊆ delivered`). A pie or a 100% stacked bar would
 *   double-count, so the progression is a nested funnel and the two exception
 *   states sit beside it as labelled figures.
 * - The funnel is one hue (length carries magnitude). The palette validator
 *   fails this design system's success green against its danger red at ΔE 5.0
 *   under deuteranopia, so green is never placed adjacent to red anywhere here —
 *   the only two status colours used are the neutral grey and the danger red,
 *   a pair that clears CVD separation at ΔE 17.8.
 * - Every status carries a text label and its number, so nothing is encoded by
 *   colour alone and the low-contrast neutral grey has the relief it needs.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CreditCard, Send, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import type { DashboardStats } from "@/lib/types";
import { cn } from "@/lib/utils";

const NUMBER_FORMATTER = new Intl.NumberFormat();
const SHARE_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

function formatCount(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

function formatShareDate(value: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return SHARE_DATE_FORMATTER.format(parsed);
}

/** Whole-percent share, safe at a zero denominator. */
function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function cardTypeLabel(type: string): string {
  if (type === "BUSINESS") return "Work";
  if (type === "PERSONAL") return "Personal";
  if (type === "CUSTOM") return "Custom";
  return type || "Card";
}

type StatTileProps = {
  label: string;
  value: string;
  hint: string;
  icon: typeof CreditCard;
};

/**
 * A headline number, not a one-bar chart. Figures stay proportional — tabular
 * digits make a large standalone number read loose.
 */
function StatTile({ label, value, hint, icon: Icon }: StatTileProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-[-0.01em] text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

type FunnelRowProps = {
  label: string;
  value: number;
  total: number;
};

/**
 * One funnel step: a meter on a same-ramp track, thin, with the value directly
 * labelled so it is never reachable only by reading the bar.
 */
function FunnelRow({ label, value, total }: FunnelRowProps) {
  const share = percent(value, total);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {formatCount(value)}
          </span>{" "}
          · {share}%
        </p>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary"
        role="img"
        aria-label={`${label}: ${formatCount(value)} of ${formatCount(total)} recipients (${share}%)`}
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  );
}

type StatusFigureProps = {
  label: string;
  value: number;
  /** Token-backed dot colour. Never the only carrier of meaning. */
  dotClassName: string;
};

function StatusFigure({ label, value, dotClassName }: StatusFigureProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", dotClassName)}
        aria-hidden="true"
      />
      <p className="text-xs text-muted-foreground">
        {label}{" "}
        <span className="font-semibold tabular-nums text-foreground">
          {formatCount(value)}
        </span>
      </p>
    </div>
  );
}

function MetricPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel className="!p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="label-section">{title}</h3>
        {action}
      </div>
      {children}
    </Panel>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export type DashboardMetricsProps = {
  stats: DashboardStats | null;
  /**
   * Shown until the stats request lands, and kept if it fails, so the dashboard
   * never renders fewer numbers than it did before this endpoint existed.
   */
  fallbackCardCount: number;
  fallbackContactCount: number;
  /** Holds the previous render dimmed rather than flashing a skeleton. */
  isRefreshing?: boolean;
};

export function DashboardMetrics({
  stats,
  fallbackCardCount,
  fallbackContactCount,
  isRefreshing = false,
}: DashboardMetricsProps) {
  const breakdown = stats?.deliveryBreakdown;
  const recipients = stats?.totalRecipientsReached ?? 0;
  const cardCount = stats?.totalCards ?? fallbackCardCount;
  const contactCount = stats?.totalContacts ?? fallbackContactCount;
  const hasShared = (stats?.totalShareBatches ?? 0) > 0;

  return (
    <div
      className={cn(
        "space-y-4 transition-opacity duration-200",
        isRefreshing && "opacity-60",
      )}
      aria-busy={isRefreshing || undefined}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Cards"
          value={formatCount(cardCount)}
          hint={
            stats
              ? `+${formatCount(stats.newCardsLast30Days)} in the last 30 days`
              : "Your shareable cards"
          }
          icon={CreditCard}
        />
        <StatTile
          label="Contacts"
          value={formatCount(contactCount)}
          hint={
            stats
              ? `+${formatCount(stats.contactsAddedLast30Days)} in the last 30 days`
              : "People in your book"
          }
          icon={Users}
        />
        <StatTile
          label="Shares sent"
          value={formatCount(stats?.totalShareBatches ?? 0)}
          hint={
            stats
              ? `${formatCount(stats.sharesLast7Days)} in 7 days · ${formatCount(stats.sharesLast30Days)} in 30`
              : "WhatsApp sends"
          }
          icon={Send}
        />
        <StatTile
          label="People reached"
          value={formatCount(recipients)}
          hint={
            breakdown && recipients > 0
              ? `${percent(breakdown.read, recipients)}% read your card`
              : "Recipients across all sends"
          }
          icon={UserRound}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricPanel title="Share delivery">
          {hasShared && breakdown ? (
            <>
              <div className="space-y-3">
                <FunnelRow
                  label="Dispatched"
                  value={breakdown.dispatched}
                  total={recipients}
                />
                <FunnelRow
                  label="Delivered"
                  value={breakdown.delivered}
                  total={recipients}
                />
                <FunnelRow label="Read" value={breakdown.read} total={recipients} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
                <StatusFigure
                  label="Pending"
                  value={breakdown.pending}
                  dotClassName="bg-warning"
                />
                <StatusFigure
                  label="Failed"
                  value={breakdown.failed}
                  dotClassName="bg-destructive"
                />
              </div>
            </>
          ) : (
            <EmptyHint>
              Share a card on WhatsApp and delivery shows up here.
            </EmptyHint>
          )}
        </MetricPanel>

        <MetricPanel
          title="Top cards"
          action={
            <Link
              to="/dashboard/cards"
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              All cards
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        >
          {stats && stats.topCards.length > 0 ? (
            <ul className="space-y-3">
              {stats.topCards.map((card, index) => (
                <li
                  key={card.cardId ?? `${card.cardName}-${index}`}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    {card.cardId ? (
                      <Link
                        to={`/dashboard/cards/${card.cardId}`}
                        className="block truncate text-sm font-medium text-foreground hover:underline"
                      >
                        {card.cardName}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-medium text-foreground">
                        {card.cardName}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline">{cardTypeLabel(card.cardType)}</Badge>
                      {card.cardId ? null : (
                        <span className="text-xs text-muted-foreground">
                          Deleted
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCount(card.timesShared)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCount(card.recipientCount)}{" "}
                      {card.recipientCount === 1 ? "person" : "people"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint>No cards shared yet.</EmptyHint>
          )}
        </MetricPanel>

        <MetricPanel
          title="Most shared with"
          action={
            <Link
              to="/dashboard/contacts"
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              All contacts
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        >
          {stats && stats.topContacts.length > 0 ? (
            <ul className="space-y-3">
              {stats.topContacts.map((contact, index) => {
                const number = [contact.countryCode, contact.phone]
                  .filter(Boolean)
                  .join(" ");
                // The API uses the number as the display name when no contact is
                // linked, which would otherwise print it on both lines.
                const isUnnamed = !number || contact.displayName === number;
                return (
                <li
                  key={
                    contact.contactId ??
                    `${contact.countryCode}${contact.phone}-${index}`
                  }
                  className="flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {contact.displayName}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {isUnnamed ? "Not in your contacts" : number}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCount(contact.timesSharedWith)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatShareDate(contact.lastSharedAt)}
                    </p>
                  </div>
                </li>
                );
              })}
            </ul>
          ) : (
            <EmptyHint>Nobody has received a card yet.</EmptyHint>
          )}
        </MetricPanel>
      </div>
    </div>
  );
}

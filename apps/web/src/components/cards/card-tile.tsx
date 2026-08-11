import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ContactCard, ContactCardType } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CardTileProps = {
  card: ContactCard;
  onShare?: (card: ContactCard) => void;
  className?: string;
};

const CARD_TYPE_LABELS: Record<ContactCardType, string> = {
  PERSONAL: "Personal",
  BUSINESS: "Work",
  CUSTOM: "Custom",
};

const updatedAtFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

/**
 * Summarises a card by what matters for sharing — name, type, and whether it
 * can go out over WhatsApp — and links through to its detail page.
 */
export function CardTile({ card, onShare, className }: CardTileProps) {
  const canShare = !card.isSensitive && Boolean(onShare);

  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-surface p-5 transition-colors duration-150 hover:bg-bg-hover",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/dashboard/cards/${card.id}`}
            className="block truncate text-base font-semibold text-foreground after:absolute after:inset-0"
          >
            {card.name}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{CARD_TYPE_LABELS[card.type]}</Badge>
            <span className="text-xs text-muted-foreground">
              Updated {updatedAtFormatter.format(new Date(card.updatedAt))}
            </span>
          </div>
          {card.isSensitive ? (
            <div className="mt-2 space-y-1">
              <StatusBadge variant="danger">Not shareable</StatusBadge>
              {/* Spelled out in visible text: `aria-label`/`title` on a badge is
                  ignored by most assistive tech, and the reason matters here. */}
              <p className="text-xs text-muted-foreground">
                Private cards can&apos;t be sent over WhatsApp.
              </p>
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          className="relative z-10 shrink-0"
          disabled={!canShare}
          onClick={() => onShare?.(card)}
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          Share
        </Button>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import {
  ConnectThumb,
  ScanThumb,
} from "@/components/cards/card-thumbs";
import { buttonVariants } from "@/components/ui/button";
import { EMPTY_CARD_FIELDS } from "@/lib/card-maker";
import type { ContactCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export function cardDetailHref(
  cardId: string,
  template: "connect" | "scan",
) {
  return `/dashboard/cards/${cardId}?template=${template}`;
}

type CardPairTileProps = {
  card: ContactCard;
  className?: string;
  /** Show card name row above the pair (Cards page). */
  showName?: boolean;
};

export function CardPairTile({
  card,
  className,
  showName = false,
}: CardPairTileProps) {
  const fields = { ...EMPTY_CARD_FIELDS, ...card.fields };
  const typeLabel =
    card.type === "CUSTOM"
      ? "Custom"
      : card.type === "BUSINESS"
        ? "Business"
        : "Personal";

  return (
    <article
      className={cn(
        "shrink-0 rounded-xl border border-border bg-surface p-4",
        className,
      )}
    >
      {showName ? (
        <div className="mb-3.5 flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {card.name}
          </h2>
          <span className="shrink-0 text-xs text-muted-foreground">
            {typeLabel}
          </span>
        </div>
      ) : null}

      <div className="flex items-stretch justify-center gap-3.5">
        <Link
          to={cardDetailHref(card.id, "connect")}
          className="outline-none transition-opacity duration-150 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          aria-label={`${card.name} Connect card`}
        >
          <ConnectThumb fields={fields} theme={card.theme} />
        </Link>
        <Link
          to={cardDetailHref(card.id, "scan")}
          className="outline-none transition-opacity duration-150 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          aria-label={`${card.name} Scan card`}
        >
          <ScanThumb fields={fields} theme={card.theme} />
        </Link>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <Link
          to={cardDetailHref(card.id, "connect")}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "justify-center rounded-full",
          )}
        >
          Connect
        </Link>
        <Link
          to={cardDetailHref(card.id, "scan")}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "justify-center rounded-full",
          )}
        >
          Scan
        </Link>
      </div>
    </article>
  );
}

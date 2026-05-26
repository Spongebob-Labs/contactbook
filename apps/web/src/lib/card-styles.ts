import type { ContactCardType } from "@/lib/types";

export const cardTypeStyles: Record<
  ContactCardType,
  {
    accentClassName: string;
    badgeClassName: string;
    faceClassName: string;
    foilClassName: string;
    initialsClassName: string;
    watermarkClassName: string;
  }
> = {
  BUSINESS: {
    accentClassName: "bg-primary",
    badgeClassName: "rounded-full bg-primary text-primary-foreground ring-primary/20",
    faceClassName:
      "bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--muted))_62%,hsl(var(--primary)/0.12)_100%)]",
    foilClassName: "bg-primary",
    initialsClassName: "bg-primary text-primary-foreground",
    watermarkClassName: "text-primary/5",
  },
  PERSONAL: {
    accentClassName: "bg-secondary",
    badgeClassName: "rounded-full bg-secondary text-secondary-foreground ring-secondary-foreground/10",
    faceClassName:
      "bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--muted))_68%,hsl(var(--secondary))_100%)]",
    foilClassName: "bg-secondary",
    initialsClassName: "bg-secondary text-secondary-foreground",
    watermarkClassName: "text-secondary-foreground/5",
  },
  PAYMENT: {
    accentClassName: "bg-accent",
    badgeClassName: "rounded-full bg-accent text-accent-foreground ring-accent-foreground/10",
    faceClassName:
      "bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--muted))_68%,hsl(var(--accent)/0.34)_100%)]",
    foilClassName: "bg-accent",
    initialsClassName: "bg-accent text-accent-foreground",
    watermarkClassName: "text-accent/10",
  },
  CUSTOM: {
    accentClassName: "bg-accent",
    badgeClassName: "rounded-full bg-accent text-accent-foreground ring-accent-foreground/10",
    faceClassName:
      "bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--muted))_68%,hsl(var(--accent)/0.34)_100%)]",
    foilClassName: "bg-accent",
    initialsClassName: "bg-accent text-accent-foreground",
    watermarkClassName: "text-accent/10",
  },
};

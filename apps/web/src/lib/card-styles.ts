import type { ContactCardType } from "@/lib/types";

/** Shared brass badge / avatar language for ContactBook cards */
const brassBadge =
  "rounded bg-accent-subtle px-2 py-[3px] text-[9px] font-semibold uppercase tracking-[0.1em] text-primary ring-0";
const brassInitialsFeatured =
  "bg-accent-subtle text-primary";
const brassInitialsMuted =
  "bg-[rgba(107,114,128,0.12)] text-[#9CA3AF]";

export const cardTypeStyles: Record<
  ContactCardType,
  {
    accentClassName: string;
    badgeClassName: string;
    faceClassName: string;
    foilClassName: string;
    initialsClassName: string;
    initialsMutedClassName: string;
    watermarkClassName: string;
    featuredBorderClassName: string;
  }
> = {
  BUSINESS: {
    accentClassName: "bg-primary",
    badgeClassName: brassBadge,
    faceClassName: "bg-card border-border",
    foilClassName: "bg-primary",
    initialsClassName: brassInitialsFeatured,
    initialsMutedClassName: brassInitialsMuted,
    watermarkClassName: "text-primary/5",
    featuredBorderClassName: "border-accent-border border-t-2 border-t-primary",
  },
  PERSONAL: {
    accentClassName: "bg-primary",
    badgeClassName: brassBadge,
    faceClassName: "bg-card border-border",
    foilClassName: "bg-primary",
    initialsClassName: brassInitialsFeatured,
    initialsMutedClassName: brassInitialsMuted,
    watermarkClassName: "text-primary/5",
    featuredBorderClassName: "border-accent-border border-t-2 border-t-primary",
  },
  PAYMENT: {
    accentClassName: "bg-primary",
    badgeClassName: brassBadge,
    faceClassName: "bg-card border-border",
    foilClassName: "bg-primary",
    initialsClassName: brassInitialsFeatured,
    initialsMutedClassName: brassInitialsMuted,
    watermarkClassName: "text-primary/5",
    featuredBorderClassName: "border-accent-border border-t-2 border-t-primary",
  },
  CUSTOM: {
    accentClassName: "bg-primary",
    badgeClassName: brassBadge,
    faceClassName: "bg-card border-border",
    foilClassName: "bg-primary",
    initialsClassName: brassInitialsFeatured,
    initialsMutedClassName: brassInitialsMuted,
    watermarkClassName: "text-primary/5",
    featuredBorderClassName: "border-accent-border border-t-2 border-t-primary",
  },
};

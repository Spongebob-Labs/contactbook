import { cn } from "@/lib/cn";

/**
 * The ContactBook logo, as the app chrome shows it: the full lockup in a wide rail and the
 * drawer, the square CB mark in a narrow one.
 *
 * Both files are the gold/brown artwork cut for the chrome (`/brand/contactbook-logo-nav.png`,
 * `/brand/contactbook-mark.png`) — the tagline-free lockup, because the tagline stops resolving
 * below ~150px wide. Decorative (`alt=""`): every caller wraps it in a link or heading that
 * carries the name "Contact Book" itself.
 *
 * The intrinsic sizes are stated so the header reserves its box before the image arrives.
 */

const ASSETS = {
  lockup: { src: "/brand/contactbook-logo-nav.png", width: 408, height: 81, className: "h-7 w-auto" },
  mark: { src: "/brand/contactbook-mark.png", width: 154, height: 154, className: "size-8" },
} as const;

export interface BrandLogoProps {
  variant: keyof typeof ASSETS;
  className?: string;
}

export function BrandLogo({ variant, className }: BrandLogoProps) {
  const asset = ASSETS[variant];
  return (
    /* A plain <img>: a small static PNG that needs no optimiser round trip in the chrome. */
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      data-brand-logo={variant}
      src={asset.src}
      alt=""
      aria-hidden="true"
      width={asset.width}
      height={asset.height}
      className={cn("max-w-none shrink-0 select-none", asset.className, className)}
      draggable={false}
    />
  );
}

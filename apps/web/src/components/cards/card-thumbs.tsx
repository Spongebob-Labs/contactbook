import {
  initialsFromName,
  resolveCardSurface,
  resolveTheme,
} from "@/lib/card-maker";
import type { ContactCardFields, ContactCardTheme } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CardQrMark, cardQrSeed } from "@/components/cards/card-qr-mark";

/** Gallery thumb width — matched pair aspect for Connect + Scan. */
export const CARD_THUMB_WIDTH = 168;

type ThumbProps = {
  fields: ContactCardFields;
  theme?: ContactCardTheme;
  className?: string;
};

function thumbCopy(fields: ContactCardFields, theme?: ContactCardTheme) {
  const resolved = resolveTheme(theme);
  const surface = resolveCardSurface(resolved.primary);
  const name = fields.displayName.trim() || "Your Name";
  const title = fields.title.trim() || "Title";
  const company = fields.company.trim() || "Company";
  const phone = fields.phone.trim()
    ? `${fields.countryCode || "+1"} ${fields.phone}`.trim()
    : "Phone";
  const email = fields.email.trim() || "Email";
  const website = fields.website.trim()
    ? fields.website.trim().replace(/^https?:\/\//i, "")
    : "Website";
  const brand =
    (fields.company.trim() || "CB")
      .split(/\s+/)[0]
      ?.slice(0, 10)
      .toUpperCase() || "CB";
  const initials = initialsFromName(name);
  const qrSeed = cardQrSeed({ name, email, phone, company, website });
  return {
    surface,
    name,
    title,
    company,
    phone,
    email,
    brand,
    initials,
    photo: fields.photoDataUrl,
    qrSeed,
  };
}

function ThumbAvatar({
  initials,
  photo,
  ink,
  fill,
  sizeClass = "h-10 w-10 text-[11px]",
  ring = false,
}: {
  initials: string;
  photo?: string;
  ink: string;
  fill?: string;
  sizeClass?: string;
  ring?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-full font-semibold",
        ring && "ring-2 ring-white shadow-sm",
        sizeClass,
      )}
      style={{
        color: ink,
        backgroundColor: photo?.trim() ? undefined : fill || "#FFFFFF",
      }}
    >
      {photo?.trim() ? (
        <img src={photo} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        initials
      )}
    </div>
  );
}

/**
 * Compact Connect face — mini Synergy share page (identity + company + CTAs).
 */
export function ConnectThumb({ fields, theme, className }: ThumbProps) {
  const { surface, name, title, company, phone, email, brand, initials, photo } =
    thumbCopy(fields, theme);

  return (
    <div
      className={cn(
        "flex w-[168px] flex-col overflow-hidden rounded-[16px] border border-border",
        "aspect-[3/4.55]",
        className,
      )}
      style={{ backgroundColor: surface.pageWash }}
    >
      <div className="flex h-full flex-col px-2 pb-2 pt-3">
        <div className="relative pt-6">
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-[20%]">
            <ThumbAvatar
              initials={initials}
              photo={photo}
              ink={surface.ink}
              fill={surface.avatarBg}
              sizeClass="h-10 w-10 text-[10px]"
              ring
            />
          </div>
          <div className="rounded-[10px] border border-border/80 bg-white px-2 pb-2 pt-6">
            <p className="line-clamp-2 text-center text-[11px] font-bold leading-snug tracking-[-0.01em] text-foreground">
              {name}
            </p>
            <p className="mt-0.5 line-clamp-1 text-center text-[8px] text-muted-foreground">
              {title}
            </p>
            <div className="mt-1.5 space-y-0.5 text-center">
              <p className="truncate text-[7px] font-medium text-foreground/80 underline decoration-foreground/20">
                {phone}
              </p>
              <p className="truncate text-[7px] font-medium text-foreground/80 underline decoration-foreground/20">
                {email}
              </p>
            </div>
            <div className="mt-2 flex items-start justify-between gap-1 border-t border-border pt-1.5">
              <div className="min-w-0">
                <p className="truncate text-[8px] font-semibold text-foreground">
                  {company}
                </p>
                <p className="truncate text-[7px] text-muted-foreground">{email}</p>
              </div>
              <p
                className="shrink-0 text-[6px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: surface.brandMuted }}
              >
                {brand}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-1 pt-2" aria-hidden="true">
          {["Save my contact", "Book a meeting", "Navigate"].map((label) => (
            <div
              key={label}
              className="flex h-[18px] items-center justify-center rounded-md"
              style={{
                backgroundColor: surface.ctaSecondaryBg,
                color: surface.ctaSecondaryFg,
              }}
            >
              <span className="text-[6px] font-medium">{label}</span>
            </div>
          ))}
          <div className="flex justify-center gap-1 pt-0.5">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: surface.socialMutedBg }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Scan face — same CardQrMark as live Scan detail preview.
 */
export function ScanThumb({ fields, theme, className }: ThumbProps) {
  const { surface, name, title, phone, email, brand, initials, photo, qrSeed } =
    thumbCopy(fields, theme);

  return (
    <div
      className={cn(
        "relative flex w-[168px] flex-col overflow-hidden rounded-[16px]",
        "aspect-[3/4.55]",
        className,
      )}
      style={{ backgroundColor: surface.primary }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.2]"
        style={{
          background:
            "linear-gradient(165deg, rgba(255,255,255,0.22) 0%, transparent 42%, rgba(0,0,0,0.08) 100%)",
        }}
        aria-hidden="true"
      />

      <div className="relative flex h-full flex-col px-2.5 pb-2.5 pt-2.5">
        <div className="flex items-start justify-between gap-1.5">
          <span
            className="max-w-[58%] truncate rounded bg-white px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: surface.ink }}
          >
            {brand}
          </span>
          <ThumbAvatar
            initials={initials}
            photo={photo}
            ink={surface.ink}
            fill="#FFFFFF"
            sizeClass="h-8 w-8 text-[9px]"
          />
        </div>

        <div className="pt-3">
          <p
            className="text-[7px] font-medium uppercase tracking-[0.14em]"
            style={{ color: surface.metaMuted }}
          >
            {title}
          </p>
          <p
            className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-tight tracking-[-0.02em]"
            style={{ color: surface.heroInk }}
          >
            {name}
          </p>
        </div>

        <div className="mt-2.5 space-y-1.5">
          <div>
            <p
              className="text-[6px] font-medium uppercase tracking-[0.14em]"
              style={{ color: surface.metaMuted }}
            >
              Phone
            </p>
            <p
              className="mt-px truncate text-[9px] font-medium"
              style={{ color: surface.metaInk }}
            >
              {phone}
            </p>
          </div>
          <div>
            <p
              className="text-[6px] font-medium uppercase tracking-[0.14em]"
              style={{ color: surface.metaMuted }}
            >
              Email
            </p>
            <p
              className="mt-px truncate text-[9px] font-medium"
              style={{ color: surface.metaInk }}
            >
              {email}
            </p>
          </div>
        </div>

        <div className="mt-auto flex justify-center pt-2.5">
          <div className="overflow-hidden rounded-[10px] bg-white p-1.5 shadow-sm">
            <CardQrMark
              seed={qrSeed}
              size={76}
              labelled={false}
              className="rounded-[2px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

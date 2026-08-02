import {
  formatCardPhone,
  hasAnySocial,
  initialsFromName,
  resolveCardSurface,
  resolveTemplate,
  resolveTheme,
  type CardSurfaceTokens,
} from "@/lib/card-maker";
import type {
  ContactCardFields,
  ContactCardTemplate,
  ContactCardTheme,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { CardQrMark, cardQrSeed } from "@/components/cards/card-qr-mark";

type LiveCardPreviewProps = {
  fields: ContactCardFields;
  theme?: ContactCardTheme;
  template?: ContactCardTemplate;
  className?: string;
  onSaveContact?: () => void;
  onShareCard?: () => void;
  /** Full-bleed share page for phone frames (Connect). */
  fillPhone?: boolean;
};

type ResolvedCardCopy = {
  name: string;
  title: string;
  phone: string;
  email: string;
  company: string;
  brand: string;
  websiteLabel: string;
  initials: string;
  isPlaceholderName: boolean;
  surface: CardSurfaceTokens;
  qrSeed: string;
};

function displayOrPlaceholder(value: string, placeholder: string) {
  const trimmed = value.trim();
  return { text: trimmed || placeholder, isPlaceholder: !trimmed };
}

function brandMark(company: string): string {
  const cleaned = company.trim();
  if (!cleaned) {
    return "CONTACTBOOK";
  }
  const first = cleaned.split(/\s+/)[0] ?? cleaned;
  return first.slice(0, 12).toUpperCase();
}

function resolveCopy(
  fields: ContactCardFields,
  theme?: ContactCardTheme,
): ResolvedCardCopy {
  const resolved = resolveTheme(theme);
  const surface = resolveCardSurface(resolved.primary);
  const name = displayOrPlaceholder(fields.displayName, "Your Name");
  const title = displayOrPlaceholder(fields.title, "Job Title");
  const phoneRaw = fields.phone.trim();
  const phone = phoneRaw
    ? formatCardPhone(fields.countryCode || "+1", phoneRaw)
    : "Phone";
  const email = displayOrPlaceholder(fields.email, "Email");
  const company = displayOrPlaceholder(fields.company, "Company");
  const websiteRaw = fields.website.trim();
  const website = websiteRaw
    ? websiteRaw.replace(/^https?:\/\//i, "")
    : "Website";

  return {
    name: name.text,
    title: title.text,
    phone,
    email: email.text,
    company: company.text,
    brand: brandMark(fields.company || company.text),
    websiteLabel: website,
    initials: initialsFromName(name.text),
    isPlaceholderName: name.isPlaceholder,
    surface,
    qrSeed: cardQrSeed({
      name: name.text,
      email: email.text,
      phone,
      company: company.text,
      website,
    }),
  };
}

function SocialGlyph({
  kind,
  color,
}: {
  kind: "facebook" | "twitter" | "linkedin";
  color: string;
}) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: color,
    "aria-hidden": true as const,
  };

  if (kind === "facebook") {
    return (
      <svg {...common}>
        <path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H9v3h2v7h3v-7h2.6l.4-3H14V9z" />
      </svg>
    );
  }
  if (kind === "twitter") {
    return (
      <svg {...common}>
        <path d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.9-6.4L6.3 22H3.2l7.3-8.3L1 2h6.3l4.4 5.8L18.9 2zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M6.5 9.5H3.7V20h2.8V9.5zM5.1 4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM20.3 13.3c0-3.2-1.7-4.7-4-4.7-1.8 0-2.6 1-3.1 1.7V9.5H10.5V20h2.8v-5.8c0-1.5.3-3 2.2-3 1.9 0 1.9 1.7 1.9 3.1V20h2.9v-6.7z" />
    </svg>
  );
}

function SocialIconRow({
  fields,
  surface,
  compact = false,
}: {
  fields: ContactCardFields;
  surface: CardSurfaceTokens;
  compact?: boolean;
}) {
  const showSocials = hasAnySocial(fields);
  const kinds = (
    showSocials
      ? (
          [
            ["facebook", fields.facebook],
            ["twitter", fields.twitter],
            ["linkedin", fields.linkedin],
          ] as const
        )
          .filter(([, value]) => value.trim())
          .map(([kind]) => kind)
      : (["facebook", "twitter", "linkedin"] as const)
  ).slice(0, 3);

  const displayKinds: Array<"facebook" | "twitter" | "linkedin"> = [
    kinds[0] ?? "facebook",
    kinds[1] ?? "twitter",
    kinds[2] ?? "linkedin",
  ];

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        compact ? "mt-0 gap-2.5" : "mt-5 gap-3",
      )}
    >
      {displayKinds.map((kind) => (
        <span
          key={kind}
          className={cn(
            "flex items-center justify-center rounded-full transition-transform duration-200",
            compact ? "h-9 w-9" : "h-10 w-10",
          )}
          style={{
            backgroundColor: showSocials
              ? surface.socialBg
              : surface.socialMutedBg,
          }}
          aria-hidden="true"
        >
          <SocialGlyph
            kind={kind}
            color={showSocials ? surface.socialFg : surface.socialMutedFg}
          />
        </span>
      ))}
    </div>
  );
}

function AvatarCircle({
  initials,
  surface,
  sizeClass,
  photoUrl,
}: {
  initials: string;
  surface: CardSurfaceTokens;
  sizeClass: string;
  photoUrl?: string;
}) {
  const hasPhoto = Boolean(photoUrl?.trim());

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-full font-semibold tracking-[0.04em] shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-[3px] ring-white",
        sizeClass,
      )}
      style={
        hasPhoto
          ? undefined
          : {
              backgroundColor: surface.avatarBg,
              color: surface.ink,
            }
      }
      aria-hidden="true"
    >
      {hasPhoto ? (
        <img
          src={photoUrl}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        initials
      )}
    </div>
  );
}

const CONNECT_ACTIONS = [
  {
    id: "save",
    label: "Save my contact",
  },
  {
    id: "meeting",
    label: "Book a meeting",
  },
  {
    id: "navigate",
    label: "Navigate to my office",
  },
] as const;

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function mapsUrlForAddress(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function websiteHref(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Connect template — Synergy-style mobile share page. */
function ConnectTemplate({
  copy,
  fields,
  className,
  fillPhone,
  onSaveContact,
  onShareCard,
}: {
  copy: ResolvedCardCopy;
  fields: ContactCardFields;
  className?: string;
  fillPhone?: boolean;
  onSaveContact?: () => void;
  onShareCard?: () => void;
}) {
  const { surface } = copy;
  const titleOnly = fields.title.trim() || copy.title;
  const companyName = fields.company.trim() || copy.company;
  const companyEmailOrWeb =
    fields.website.trim() ||
    (fields.email.trim() ? fields.email.trim() : copy.email);
  const phoneDigits = fields.phone.trim()
    ? `${fields.countryCode || "+1"}${fields.phone}`.replace(/\s+/g, "")
    : "";
  const address = fields.address.trim();
  const meetingUrl = websiteHref(fields.website);

  const handleAction = (id: (typeof CONNECT_ACTIONS)[number]["id"]) => {
    if (id === "save") {
      onSaveContact?.();
      return;
    }
    if (id === "meeting") {
      if (meetingUrl) {
        openExternal(meetingUrl);
        return;
      }
      onShareCard?.();
      return;
    }
    if (id === "navigate") {
      if (address) {
        openExternal(mapsUrlForAddress(address));
      }
    }
  };

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col",
        fillPhone
          ? "h-full max-w-none rounded-none border-0 px-5 pb-8 pt-10 shadow-none"
          : "max-w-[360px] overflow-hidden rounded-[22px] border border-border/70 px-5 pb-7 pt-9 shadow-[0_12px_36px_rgba(15,23,42,0.08)]",
        className,
      )}
      style={{ backgroundColor: surface.pageWash }}
    >
      <div
        className={cn(
          "relative shrink-0",
          fillPhone ? "pt-9" : "pt-11",
        )}
      >
        <div
          className={cn(
            "absolute left-1/2 top-0 z-10 -translate-x-1/2",
            fillPhone ? "-translate-y-[22%]" : "-translate-y-[28%]",
          )}
        >
          <AvatarCircle
            initials={copy.initials}
            surface={surface}
            photoUrl={fields.photoDataUrl}
            sizeClass={
              fillPhone
                ? "h-[84px] w-[84px] text-[22px]"
                : "h-[92px] w-[92px] text-[24px]"
            }
          />
        </div>

        <div
          className={cn(
            "rounded-2xl border border-border/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
            fillPhone ? "px-4 pb-4 pt-14" : "px-5 pb-5 pt-[3.75rem]",
          )}
        >
          <div className="text-center">
            <h3
              className={cn(
                "font-sans font-bold leading-[1.15] tracking-[-0.02em] text-foreground transition-opacity duration-150",
                fillPhone ? "text-[24px]" : "text-[26px]",
                copy.isPlaceholderName && "opacity-45",
              )}
            >
              {copy.name}
            </h3>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {titleOnly}
            </p>

            <div
              className={cn(
                "space-y-1.5",
                fillPhone ? "mt-3.5" : "mt-4",
              )}
            >
              <a
                href={phoneDigits ? `tel:${phoneDigits}` : undefined}
                className={cn(
                  "block text-[14px] font-medium text-foreground underline decoration-foreground/25 underline-offset-[3px]",
                  !phoneDigits && "pointer-events-none",
                )}
              >
                {copy.phone}
              </a>
              <a
                href={
                  fields.email.trim() || copy.email
                    ? `mailto:${fields.email.trim() || copy.email}`
                    : undefined
                }
                className="block break-all text-[14px] font-medium text-foreground underline decoration-foreground/25 underline-offset-[3px]"
              >
                {copy.email}
              </a>
            </div>
          </div>

          <div
            className={cn(
              "border-t border-border",
              fillPhone ? "mt-4 pt-3.5" : "mt-5 pt-4",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-left">
                <p className="truncate text-[15px] font-semibold text-foreground">
                  {companyName}
                </p>
                <a
                  href={
                    meetingUrl ||
                    (companyEmailOrWeb.includes("@")
                      ? `mailto:${companyEmailOrWeb}`
                      : undefined)
                  }
                  className="mt-1 block truncate text-[13px] font-medium text-foreground/80 underline decoration-foreground/20 underline-offset-[3px]"
                >
                  {companyEmailOrWeb}
                </a>
                {address ? (
                  <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                    {address}
                  </p>
                ) : null}
              </div>
              <p
                className="shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: surface.brandMuted }}
              >
                {copy.brand}
              </p>
            </div>
          </div>
        </div>
      </div>

      {fillPhone ? <div className="min-h-3 flex-1" aria-hidden="true" /> : null}

      <div
        className={cn(
          "grid shrink-0",
          fillPhone ? "gap-2.5" : "mt-5 gap-2.5",
        )}
      >
        {CONNECT_ACTIONS.map(({ id, label }) => {
          const interactive =
            id === "save"
              ? Boolean(onSaveContact)
              : id === "meeting"
                ? Boolean(meetingUrl || onShareCard)
                : Boolean(address);
          const Comp = interactive || id === "save" ? "button" : "div";
          return (
            <Comp
              key={id}
              type={Comp === "button" ? "button" : undefined}
              onClick={
                Comp === "button" ? () => handleAction(id) : undefined
              }
              className={cn(
                "flex items-center justify-center rounded-xl border px-4 font-medium transition-opacity duration-150",
                fillPhone ? "h-11 text-[14px]" : "h-12 text-[15px]",
                Comp === "button" && "cursor-pointer hover:opacity-90",
              )}
              style={{
                backgroundColor: surface.ctaSecondaryBg,
                color: surface.ctaSecondaryFg,
                borderColor: surface.ctaSecondaryBorder,
              }}
            >
              {label}
            </Comp>
          );
        })}
      </div>

      <div className={cn("shrink-0", fillPhone ? "mt-5" : "mt-1")}>
        <SocialIconRow fields={fields} surface={surface} compact={fillPhone} />
      </div>
    </div>
  );
}

/**
 * Scan template — balanced identity hierarchy + moderated QR plate.
 * QR is present but does not crowd the name/contact block.
 */
function ScanTemplate({
  copy,
  photoUrl,
  className,
}: {
  copy: ResolvedCardCopy;
  photoUrl?: string;
  className?: string;
}) {
  const { surface } = copy;
  const hasPhoto = Boolean(photoUrl?.trim());

  return (
    <div
      className={cn(
        "relative mx-auto aspect-[3/4.8] w-full max-w-[360px] overflow-hidden rounded-[28px] shadow-[0_18px_44px_rgba(15,23,42,0.16)]",
        className,
      )}
      style={{ backgroundColor: surface.primary }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.24]"
        style={{
          background:
            "linear-gradient(165deg, rgba(255,255,255,0.2) 0%, transparent 38%, rgba(0,0,0,0.08) 100%)",
        }}
        aria-hidden="true"
      />

      <div className="relative flex h-full flex-col px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div
            className="max-w-[62%] truncate rounded-md bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] shadow-sm"
            style={{ color: surface.ink }}
          >
            {copy.brand}
          </div>
          <div
            className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[15px] font-semibold tracking-[0.04em] shadow-sm"
            style={{ color: surface.ink }}
            aria-hidden="true"
          >
            {hasPhoto ? (
              <img
                src={photoUrl}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              copy.initials
            )}
          </div>
        </div>

        <div className="mt-6">
          <p
            className="text-[10px] font-medium uppercase tracking-[0.18em]"
            style={{ color: surface.metaMuted }}
          >
            {copy.title}
          </p>
          <h3
            className={cn(
              "mt-1.5 font-sans text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[30px]",
              copy.isPlaceholderName && "opacity-55",
            )}
            style={{ color: surface.heroInk }}
          >
            {copy.name}
          </h3>
        </div>

        <div className="mt-5 space-y-3.5">
          <div>
            <p
              className="text-[10px] font-medium uppercase tracking-[0.16em]"
              style={{ color: surface.metaMuted }}
            >
              Phone
            </p>
            <p
              className="mt-1 text-[14px] font-medium tracking-[-0.01em]"
              style={{ color: surface.metaInk }}
            >
              {copy.phone}
            </p>
          </div>
          <div>
            <p
              className="text-[10px] font-medium uppercase tracking-[0.16em]"
              style={{ color: surface.metaMuted }}
            >
              Email
            </p>
            <p
              className="mt-1 break-all text-[14px] font-medium tracking-[-0.01em]"
              style={{ color: surface.metaInk }}
            >
              {copy.email}
            </p>
          </div>
        </div>

        <div className="mt-auto flex justify-center pt-5">
          <div className="rounded-[14px] bg-white p-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.12)]">
            <CardQrMark seed={copy.qrSeed} size={118} className="rounded-[4px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LiveCardPreview({
  fields,
  theme,
  template,
  className,
  onSaveContact,
  onShareCard,
  fillPhone,
}: LiveCardPreviewProps) {
  const copy = resolveCopy(fields, theme);
  const resolved = resolveTemplate(template);

  if (resolved === "scan") {
    return (
      <ScanTemplate
        copy={copy}
        photoUrl={fields.photoDataUrl}
        className={className}
      />
    );
  }

  return (
    <ConnectTemplate
      copy={copy}
      fields={fields}
      className={className}
      fillPhone={fillPhone}
      onSaveContact={onSaveContact}
      onShareCard={onShareCard}
    />
  );
}

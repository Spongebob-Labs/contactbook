import type { CSSProperties, ReactNode } from "react";
import type {
  CardBlock,
  CardContactMethod,
  CardContactType,
  CardIdentity,
  CardSnapshot,
  CardSocial,
  CardSocialPlatform,
} from "@/lib/card-schema";
import type { CardTokens } from "@/lib/card-themes";
import { withAlpha } from "@/lib/card-themes";
import { cn } from "@/lib/utils";

/**
 * Primitives shared by every card layout.
 *
 * These deliberately style themselves from `CardTokens` and inline styles
 * rather than the app's Tailwind design tokens. A published card is rendered on
 * a public page that has nothing to do with the dashboard's theme — using
 * `text-foreground` here would make a stranger's view of the card depend on
 * whichever app shell happened to wrap it.
 */

/** Every layout receives exactly this — no layout reaches for app state. */
export type CardLayoutProps = {
  snapshot: CardSnapshot;
  tokens: CardTokens;
  /** False inside the builder preview, so clicks never navigate the editor away. */
  interactive: boolean;
  /** Supplied by the caller; phase 4 passes a real scannable QR. */
  qr?: ReactNode;
  onSaveContact?: () => void;
};

/* ------------------------------------------------------------------- links */

const CONTACT_DEFAULT_LABEL: Record<CardContactType, string> = {
  phone: "Call",
  email: "Email",
  website: "Website",
  address: "Directions",
};

export function contactLabel(method: CardContactMethod): string {
  return method.label.trim() || CONTACT_DEFAULT_LABEL[method.type];
}

/** Type predicate — `.filter(b => b.type === "link")` alone does not narrow the union. */
export function isLinkBlock(
  block: CardBlock,
): block is Extract<CardBlock, { type: "link" }> {
  return block.type === "link";
}


export function contactHref(method: CardContactMethod): string | undefined {
  const value = method.value.trim();
  if (!value) {
    return undefined;
  }

  switch (method.type) {
    case "phone":
      return `tel:${value.replace(/[^\d+]/g, "")}`;
    case "email":
      return `mailto:${value}`;
    case "website":
      return externalHref(value);
    case "address":
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
    default:
      return undefined;
  }
}

export function externalHref(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Strips the scheme so a link reads as a label rather than a URL. */
export function prettyUrl(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function initialsFrom(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return initials || "CB";
}

/* ------------------------------------------------------------------ avatar */

export function CardAvatar({
  identity,
  tokens,
  size,
  className,
}: {
  identity: CardIdentity;
  tokens: CardTokens;
  size: number;
  className?: string;
}) {
  const photo = identity.photo.trim();

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        backgroundColor: photo ? "transparent" : withAlpha(tokens.accent, 0.9),
        color: tokens.isDark ? "#111111" : "#FFFFFF",
        boxShadow: `0 0 0 3px ${withAlpha(tokens.text, 0.14)}`,
        fontFamily: tokens.fontHeading,
      }}
      aria-hidden="true"
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        initialsFrom(identity.displayName)
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ button */

/**
 * The themed full-width action. Renders as an anchor when it has somewhere to
 * go and the card is interactive, as a button when it has a handler, and as an
 * inert div inside the builder preview — so clicking the preview never
 * navigates the editor away.
 */
export function CardActionButton({
  tokens,
  label,
  description,
  href,
  onClick,
  interactive,
  leading,
  className,
}: {
  tokens: CardTokens;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  interactive: boolean;
  leading?: ReactNode;
  className?: string;
}) {
  const style: CSSProperties = {
    background: tokens.button.background,
    color: tokens.button.color,
    border: tokens.button.border,
    boxShadow: tokens.button.shadow,
    borderRadius: tokens.radius,
    fontFamily: tokens.fontBody,
  };

  const content = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1 text-center">
        <span className="block truncate text-[15px] font-semibold leading-tight">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block truncate text-[12px] opacity-75">
            {description}
          </span>
        ) : null}
      </span>
      {leading ? <span className="w-4 shrink-0" aria-hidden="true" /> : null}
    </>
  );

  const shared = cn(
    "flex w-full items-center gap-3 px-4 py-3.5 transition-transform duration-150",
    interactive && "hover:-translate-y-px active:translate-y-0",
    className,
  );

  if (interactive && href) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        className={shared}
        style={style}
      >
        {content}
      </a>
    );
  }

  if (interactive && onClick) {
    return (
      <button type="button" onClick={onClick} className={shared} style={style}>
        {content}
      </button>
    );
  }

  return (
    <div className={shared} style={style}>
      {content}
    </div>
  );
}

/* ------------------------------------------------------------------ social */

const SOCIAL_PATHS: Record<CardSocialPlatform, string> = {
  linkedin:
    "M6.5 9.5H3.7V20h2.8V9.5zM5.1 4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM20.3 13.3c0-3.2-1.7-4.7-4-4.7-1.8 0-2.6 1-3.1 1.7V9.5H10.5V20h2.8v-5.8c0-1.5.3-3 2.2-3 1.9 0 1.9 1.7 1.9 3.1V20h2.9v-6.7z",
  x: "M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.9-6.4L6.3 22H3.2l7.3-8.3L1 2h6.3l4.4 5.8L18.9 2zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20z",
  instagram:
    "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.2A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4zm0 10.9A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3zm6.9-11.1a1.5 1.5 0 1 1-1.5-1.5 1.5 1.5 0 0 1 1.5 1.5z",
  facebook: "M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H9v3h2v7h3v-7h2.6l.4-3H14V9z",
  github:
    "M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z",
  youtube:
    "M21.6 7.2s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16 4.1 12 4.1 12 4.1s-4 0-6.8.2c-.4.1-1.2.1-2 .9-.6.6-.8 2-.8 2S2.2 8.8 2.2 10.5v1.6c0 1.6.2 3.3.2 3.3s.2 1.4.8 2c.8.8 1.8.8 2.2.9 1.6.1 6.8.2 6.8.2s4 0 6.8-.2c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.3v-1.6c0-1.7-.2-3.3-.2-3.3zM9.9 14.6V8.9l5.2 2.9-5.2 2.8z",
  tiktok:
    "M16.6 5.8a4.8 4.8 0 0 1-1-2.8h-2.9v11.6a2.5 2.5 0 1 1-1.8-2.4V9.2a5.5 5.5 0 1 0 4.7 5.4V9a7.7 7.7 0 0 0 4.4 1.4V7.5a4.7 4.7 0 0 1-3.4-1.7z",
  whatsapp:
    "M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.4A9.9 9.9 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-3-.2-.3A8 8 0 1 1 12 20zm4.5-5.9c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2a.4.4 0 0 0 0-.4c0-.1-.5-1.3-.7-1.8s-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.1 11.1 0 0 0 4.3 3.8c1.6.6 2.2.7 3 .6a2.5 2.5 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z",
  telegram:
    "M21.9 4.3 18.7 19.5c-.2 1.1-.9 1.3-1.8.8l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6.1 12.9l-5-1.6c-1.1-.3-1.1-1 .2-1.5l19.4-7.5c.9-.3 1.7.2 1.4 2z",
};

export function CardSocialRow({
  socials,
  tokens,
  interactive,
  size = 40,
  className,
}: {
  socials: CardSocial[];
  tokens: CardTokens;
  interactive: boolean;
  size?: number;
  className?: string;
}) {
  if (socials.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2.5", className)}>
      {socials.map((social) => {
        const href = externalHref(social.url);
        const Tag = interactive && href ? "a" : "span";

        return (
          <Tag
            key={social.id}
            {...(Tag === "a"
              ? {
                  href,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  "aria-label": social.platform,
                }
              : { "aria-hidden": "true" as const })}
            className="flex items-center justify-center rounded-full transition-opacity duration-150 hover:opacity-80"
            style={{
              width: size,
              height: size,
              backgroundColor: withAlpha(tokens.text, tokens.isDark ? 0.12 : 0.08),
              color: tokens.text,
            }}
          >
            <svg
              width={size * 0.45}
              height={size * 0.45}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d={SOCIAL_PATHS[social.platform]} />
            </svg>
          </Tag>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ header */

export function CardIdentityHeader({
  identity,
  tokens,
  avatarSize = 96,
  align = "center",
}: {
  identity: CardIdentity;
  tokens: CardTokens;
  avatarSize?: number;
  align?: "center" | "left";
}) {
  const subtitle = [identity.title, identity.company]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center text-center" : "items-start text-left",
      )}
    >
      <CardAvatar identity={identity} tokens={tokens} size={avatarSize} />
      <div className="w-full">
        <h1
          className="text-[26px] font-bold leading-[1.15] tracking-[-0.02em]"
          style={{ color: tokens.text, fontFamily: tokens.fontHeading }}
        >
          {identity.displayName}
        </h1>
        {subtitle ? (
          <p
            className="mt-1 text-[14px] leading-snug"
            style={{ color: tokens.textMuted, fontFamily: tokens.fontBody }}
          >
            {subtitle}
          </p>
        ) : null}
        {identity.bio.trim() ? (
          <p
            className="mt-2.5 text-[13px] leading-relaxed"
            style={{ color: tokens.textMuted, fontFamily: tokens.fontBody }}
          >
            {identity.bio}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ blocks */

export function CardHeadingBlock({
  text,
  tokens,
}: {
  text: string;
  tokens: CardTokens;
}) {
  return (
    <p
      className="pt-2 text-[11px] font-semibold uppercase tracking-[0.16em]"
      style={{ color: tokens.textFaint, fontFamily: tokens.fontBody }}
    >
      {text}
    </p>
  );
}

export function CardTextBlock({
  text,
  tokens,
}: {
  text: string;
  tokens: CardTokens;
}) {
  return (
    <p
      className="text-[13px] leading-relaxed"
      style={{ color: tokens.textMuted, fontFamily: tokens.fontBody }}
    >
      {text}
    </p>
  );
}

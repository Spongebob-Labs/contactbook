import {
  CardAvatar,
  CardSocialRow,
  contactHref,
  contactLabel,
  externalHref,
  isLinkBlock,
  prettyUrl,
  type CardLayoutProps,
} from "@/components/cards/render/card-render-parts";
import {
  visibleBlocks,
  visibleContactMethods,
  visibleSocials,
} from "@/lib/card-schema";
import { withAlpha } from "@/lib/card-themes";

/**
 * Compact — contact-first and left-aligned, with no floating panel and no
 * oversized avatar. Details are rows rather than buttons, so a card with eight
 * contact methods stays one screen instead of scrolling forever.
 *
 * This is the layout for someone whose card is a rolodex entry, not a landing
 * page: the fastest possible path from "scanned" to "found the number".
 */
export function CompactLayout({
  snapshot,
  tokens,
  interactive,
  onSaveContact,
}: CardLayoutProps) {
  const { identity } = snapshot;
  const contact = visibleContactMethods(snapshot);
  const socials = visibleSocials(snapshot);
  const links = visibleBlocks(snapshot).filter(isLinkBlock);

  const subtitle = [identity.title, identity.company]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-6 px-5 pb-12 pt-10">
      <div className="flex items-center gap-4">
        <CardAvatar identity={identity} tokens={tokens} size={72} />
        <div className="min-w-0">
          <h1
            className="text-[21px] font-bold leading-tight tracking-[-0.02em]"
            style={{ color: tokens.text, fontFamily: tokens.fontHeading }}
          >
            {identity.displayName}
          </h1>
          {subtitle ? (
            <p
              className="mt-0.5 text-[13px] leading-snug"
              style={{ color: tokens.textMuted, fontFamily: tokens.fontBody }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {identity.bio.trim() ? (
        <p
          className="text-[13px] leading-relaxed"
          style={{ color: tokens.textMuted, fontFamily: tokens.fontBody }}
        >
          {identity.bio}
        </p>
      ) : null}

      {contact.length > 0 ? (
        <div className="flex flex-col">
          {contact.map((method, index) => {
            const href = interactive ? contactHref(method) : undefined;
            const value =
              method.type === "website" ? prettyUrl(method.value) : method.value;
            const Tag = href ? "a" : "div";

            return (
              <Tag
                key={method.id}
                {...(href
                  ? {
                      href,
                      target: href.startsWith("http") ? "_blank" : undefined,
                      rel: href.startsWith("http")
                        ? "noopener noreferrer"
                        : undefined,
                    }
                  : {})}
                className="flex items-baseline justify-between gap-4 py-3 transition-opacity duration-150 hover:opacity-75"
                style={{
                  borderTop:
                    index === 0 ? "none" : `1px solid ${tokens.hairline}`,
                }}
              >
                <span
                  className="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em]"
                  style={{ color: tokens.textFaint }}
                >
                  {contactLabel(method)}
                </span>
                <span
                  className="min-w-0 break-words text-right text-[14px] font-medium"
                  style={{ color: tokens.text, fontFamily: tokens.fontBody }}
                >
                  {value}
                </span>
              </Tag>
            );
          })}
        </div>
      ) : null}

      {onSaveContact ? (
        <button
          type="button"
          onClick={interactive ? onSaveContact : undefined}
          className="w-full px-4 py-3 text-[14px] font-semibold transition-transform duration-150 hover:-translate-y-px"
          style={{
            background: tokens.button.background,
            color: tokens.button.color,
            border: tokens.button.border,
            boxShadow: tokens.button.shadow,
            borderRadius: tokens.radius,
            fontFamily: tokens.fontBody,
          }}
        >
          Save my contact
        </button>
      ) : null}

      {links.length > 0 ? (
        <div className="flex flex-col gap-1">
          {links.map((block) => {
            const href = interactive ? externalHref(block.url) : undefined;
            const Tag = href ? "a" : "div";

            return (
              <Tag
                key={block.id}
                {...(href
                  ? { href, target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="flex items-center justify-between gap-3 py-2 text-[14px] transition-opacity duration-150 hover:opacity-75"
                style={{ color: tokens.text, fontFamily: tokens.fontBody }}
              >
                <span className="min-w-0 truncate font-medium">
                  {block.label}
                </span>
                <span
                  className="shrink-0 text-[16px] leading-none"
                  style={{ color: withAlpha(tokens.text, 0.45) }}
                  aria-hidden="true"
                >
                  →
                </span>
              </Tag>
            );
          })}
        </div>
      ) : null}

      <CardSocialRow
        socials={socials}
        tokens={tokens}
        interactive={interactive}
        size={36}
        className="justify-start"
      />
    </div>
  );
}

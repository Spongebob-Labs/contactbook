import {
  CardActionButton,
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
 * Card face — the business-card silhouette, and the layout the Wallet pass is
 * modelled on. Identity and contact details sit on a floating panel with the QR
 * given real estate rather than tucked away, because this is the layout people
 * choose when the card is meant to be *scanned* in person.
 */
export function CardFaceLayout({
  snapshot,
  tokens,
  interactive,
  qr,
  onSaveContact,
}: CardLayoutProps) {
  const { identity } = snapshot;
  const contact = visibleContactMethods(snapshot);
  const socials = visibleSocials(snapshot);
  // Card face is a *card*, not a landing page — headings and prose belong to
  // the stack layout, so only real links survive here.
  const blocks = visibleBlocks(snapshot).filter(isLinkBlock);

  const subtitle = [identity.title, identity.company]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-5 px-5 pb-12 pt-10">
      {/* p-5 not p-6: inside a 390pt phone the outer px-5 plus a 24px panel
          inset left the name column ~142px, which truncated ordinary names. */}
      <div
        className="flex flex-col gap-5 p-5"
        style={{
          background: tokens.surface,
          border: `1px solid ${tokens.surfaceBorder}`,
          borderRadius:
            tokens.radius === "999px" ? "28px" : `calc(${tokens.radius} + 8px)`,
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="flex items-center gap-3">
          <CardAvatar identity={identity} tokens={tokens} size={56} />
          {/* Wrapping beats truncating here — a clipped name on a business
              card is worse than one that runs to a second line. */}
          <div className="min-w-0">
            <h1
              className="text-[21px] font-bold leading-[1.15] tracking-[-0.02em]"
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

        {contact.length > 0 ? (
          <dl
            className="flex flex-col gap-2.5 pt-1"
            style={{ borderTop: `1px solid ${tokens.hairline}` }}
          >
            {contact.map((method) => {
              const href = interactive ? contactHref(method) : undefined;
              const value =
                method.type === "website"
                  ? prettyUrl(method.value)
                  : method.value;

              return (
                <div
                  key={method.id}
                  className="flex items-baseline justify-between gap-3 pt-2"
                >
                  <dt
                    className="shrink-0 text-[10px] font-medium uppercase tracking-[0.1em]"
                    style={{ color: tokens.textFaint }}
                  >
                    {contactLabel(method)}
                  </dt>
                  <dd
                    className="min-w-0 break-words text-right text-[13px] font-medium"
                    style={{ color: tokens.text, fontFamily: tokens.fontBody }}
                  >
                    {href ? (
                      <a
                        href={href}
                        target={href.startsWith("http") ? "_blank" : undefined}
                        rel={
                          href.startsWith("http")
                            ? "noopener noreferrer"
                            : undefined
                        }
                        className="underline underline-offset-[3px]"
                        style={{ textDecorationColor: withAlpha(tokens.text, 0.3) }}
                      >
                        {value}
                      </a>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : null}

        {qr ? (
          <div className="flex flex-col items-center gap-2 pt-1">
            <div
              className="overflow-hidden bg-white p-2.5"
              style={{ borderRadius: "14px" }}
            >
              {qr}
            </div>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: tokens.textFaint }}
            >
              Scan to connect
            </p>
          </div>
        ) : null}
      </div>

      {onSaveContact ? (
        <CardActionButton
          tokens={tokens}
          label="Save my contact"
          onClick={onSaveContact}
          interactive={interactive}
        />
      ) : null}

      {blocks.map((block) => (
        <CardActionButton
          key={block.id}
          tokens={tokens}
          label={block.label}
          description={block.description || undefined}
          href={externalHref(block.url)}
          interactive={interactive}
        />
      ))}

      <CardSocialRow
        socials={socials}
        tokens={tokens}
        interactive={interactive}
        size={36}
        className="pt-1"
      />
    </div>
  );
}

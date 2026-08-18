import {
  CardActionButton,
  CardHeadingBlock,
  CardIdentityHeader,
  CardSocialRow,
  CardTextBlock,
  contactHref,
  contactLabel,
  externalHref,
  prettyUrl,
  type CardLayoutProps,
} from "@/components/cards/render/card-render-parts";
import {
  visibleBlocks,
  visibleContactMethods,
  visibleSocials,
} from "@/lib/card-schema";

/**
 * Stack — the Linktree silhouette. Centred identity, social row, then a single
 * column of full-width actions: contact methods first, custom blocks after.
 *
 * This is the layout that makes the block list feel native, so it is the
 * default for anyone who wants a link-in-bio page rather than a business card.
 */
export function StackLayout({
  snapshot,
  tokens,
  interactive,
  onSaveContact,
}: CardLayoutProps) {
  const contact = visibleContactMethods(snapshot);
  const socials = visibleSocials(snapshot);
  const blocks = visibleBlocks(snapshot);

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-6 px-5 pb-12 pt-12">
      <CardIdentityHeader identity={snapshot.identity} tokens={tokens} />

      <CardSocialRow
        socials={socials}
        tokens={tokens}
        interactive={interactive}
      />

      <div className="flex flex-col gap-2.5">
        {onSaveContact ? (
          <CardActionButton
            tokens={tokens}
            label="Save my contact"
            onClick={onSaveContact}
            interactive={interactive}
          />
        ) : null}

        {contact.map((method) => (
          <CardActionButton
            key={method.id}
            tokens={tokens}
            label={contactLabel(method)}
            description={
              method.type === "website"
                ? prettyUrl(method.value)
                : method.value
            }
            href={contactHref(method)}
            interactive={interactive}
          />
        ))}

        {blocks.map((block) => {
          if (block.type === "heading") {
            return (
              <CardHeadingBlock
                key={block.id}
                text={block.text}
                tokens={tokens}
              />
            );
          }

          if (block.type === "text") {
            return (
              <CardTextBlock key={block.id} text={block.text} tokens={tokens} />
            );
          }

          return (
            <CardActionButton
              key={block.id}
              tokens={tokens}
              label={block.label}
              description={block.description || undefined}
              href={externalHref(block.url)}
              interactive={interactive}
            />
          );
        })}
      </div>
    </div>
  );
}

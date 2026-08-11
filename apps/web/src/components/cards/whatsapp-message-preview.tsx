import { Fragment, useMemo, useState } from "react";
import { Download, Reply } from "lucide-react";
import { renderTemplateBody } from "@/lib/card-share-api";
import type { ShareTemplate } from "@/lib/card-share-types";
import { classifyShareTemplate } from "@/lib/share-template-capabilities";
import { cn } from "@/lib/utils";

export type WhatsappMessagePreviewProps = {
  template: ShareTemplate | null;
  senderName: string;
  cardName: string;
  note?: string;
  /** Renders a compact variant for tight columns. */
  compact?: boolean;
  className?: string;
};

const PLACEHOLDER_PATTERN = /(\{\{1\}\}|\{\{2\}\}|\{\{3\}\})/g;

/**
 * Splits a raw template body around its `{{1}}`/`{{2}}`/`{{3}} placeholders so
 * the sender name and card name can be highlighted without post-processing the
 * fully rendered string.
 */
function splitTemplateBody(body: string): string[] {
  return body.split(PLACEHOLDER_PATTERN);
}

/** Renders a WhatsApp incoming-message bubble exactly as a recipient will see it. */
export function WhatsappMessagePreview({
  template,
  senderName,
  cardName,
  note,
  compact = false,
  className,
}: WhatsappMessagePreviewProps) {
  const timestamp = useMemo(
    () => new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date()),
    [],
  );

  // Reuses renderTemplateBody as the source of truth for note semantics (an
  // empty note collapses to a single space) instead of duplicating that logic.
  const noteSegment = useMemo(
    () => renderTemplateBody("{{3}}", { senderName: "", cardName: "", note }),
    [note],
  );

  const [erroredImageUrl, setErroredImageUrl] = useState<string | null>(null);
  const showHeaderImage =
    !compact && !!template?.headerImageUrl && template.headerImageUrl !== erroredImageUrl;

  const buttonLabel = template?.buttonTitle || "Get Contact";

  // A URL button hands the recipient the file on the first tap; a quick reply
  // only opens a session. Same-looking button, two experiences — so the icon and
  // the caption below the bubble carry the difference.
  const capabilities = template ? classifyShareTemplate(template) : null;
  const ButtonIcon = capabilities?.deliversVcfInButton ? Download : Reply;
  const buttonAffordance = capabilities?.deliversVcfInButton
    ? "Tapping downloads the contact file"
    : "Tapping replies — the contact file follows";

  return (
    <div
      role="group"
      aria-label="WhatsApp message preview"
      className={cn(
        "rounded-lg border border-border bg-muted",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <div className="max-w-[320px] overflow-hidden rounded-lg border border-border bg-surface">
        {showHeaderImage && template?.headerImageUrl ? (
          <img
            src={template.headerImageUrl}
            alt=""
            loading="lazy"
            className="aspect-[1.91/1] w-full rounded-t-lg object-cover"
            onError={() => setErroredImageUrl(template.headerImageUrl)}
          />
        ) : null}

        <div className={cn("space-y-1", compact ? "p-2.5" : "p-3")}>
          {template ? (
            <p
              className={cn(
                "whitespace-pre-wrap text-sm text-foreground",
                compact && "line-clamp-3",
              )}
            >
              {splitTemplateBody(template.body).map((part, index) => {
                if (part === "{{1}}") {
                  return (
                    <span key={`sender-${index}`} className="font-medium text-foreground">
                      {senderName}
                    </span>
                  );
                }
                if (part === "{{2}}") {
                  return (
                    <span key={`card-${index}`} className="font-medium text-foreground">
                      {cardName}
                    </span>
                  );
                }
                if (part === "{{3}}") {
                  return <Fragment key={`note-${index}`}>{noteSegment}</Fragment>;
                }
                return <Fragment key={`text-${index}`}>{part}</Fragment>;
              })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a template to preview the message
            </p>
          )}

          <p className="text-right text-[11px] text-muted-foreground">{timestamp}</p>
        </div>

        <div className="border-t border-border">
          <div
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium",
              template ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <ButtonIcon className="h-4 w-4" aria-hidden="true" />
            {buttonLabel}
          </div>
        </div>
      </div>

      {capabilities ? (
        <p
          className={cn(
            "max-w-[320px] text-xs text-muted-foreground",
            compact ? "mt-1.5" : "mt-2",
          )}
        >
          {buttonAffordance}
        </p>
      ) : null}
    </div>
  );
}

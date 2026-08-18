import { Check, Copy, Dot, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * - draft   never published; no public URL exists yet
 * - live    published and the draft matches what is public
 * - dirty   published, but the draft has moved on
 * - offline published once, then taken down; the slug is still reserved
 */
export type PublishState = "draft" | "live" | "dirty" | "offline";

const STATUS: Record<
  PublishState,
  { label: string; tone: string; detail: string }
> = {
  draft: {
    label: "Not published",
    tone: "text-muted-foreground",
    detail: "Publish to get a shareable link.",
  },
  live: {
    label: "Live",
    tone: "text-emerald-600",
    detail: "Anyone with the link can see this card.",
  },
  dirty: {
    label: "Unpublished changes",
    tone: "text-amber-600",
    detail: "The live card still shows the last published version.",
  },
  offline: {
    label: "Offline",
    tone: "text-muted-foreground",
    detail: "The link is reserved and will work again when you publish.",
  },
};

export function PublishBar({
  state,
  shareUrl,
  isPublishing,
  isUnpublishing,
  onPublish,
  onUnpublish,
  onCopyLink,
  copied,
}: {
  state: PublishState;
  shareUrl: string | null;
  isPublishing: boolean;
  isUnpublishing: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onCopyLink: () => void;
  copied: boolean;
}) {
  const status = STATUS[state];
  const canPublish = state !== "live";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-[13px] font-semibold">
          <Dot className={cn("h-5 w-5 shrink-0", status.tone)} aria-hidden="true" />
          <span className={status.tone}>{status.label}</span>
        </p>
        <p className="mt-0.5 pl-6 text-[12px] text-muted-foreground">
          {status.detail}
        </p>

        {shareUrl ? (
          <div className="mt-2 flex items-center gap-2 pl-6">
            <Globe
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="truncate font-mono text-[12px] text-muted-foreground">
              {shareUrl.replace(/^https?:\/\//, "")}
            </span>
            <button
              type="button"
              onClick={onCopyLink}
              aria-label="Copy link"
              title="Copy link"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-bg-hover hover:text-foreground"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {state === "live" || state === "dirty" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUnpublishing || isPublishing}
            onClick={onUnpublish}
          >
            {isUnpublishing ? "Taking down…" : "Unpublish"}
          </Button>
        ) : null}

        <Button
          type="button"
          size="sm"
          disabled={!canPublish || isPublishing || isUnpublishing}
          onClick={onPublish}
        >
          {isPublishing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          {isPublishing
            ? "Publishing…"
            : state === "draft"
              ? "Publish"
              : state === "offline"
                ? "Publish again"
                : state === "dirty"
                  ? "Publish changes"
                  : "Published"}
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type JSX } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApiError } from "@/lib/api";
import {
  getCardShareBatch,
  resendShareRecipient,
} from "@/lib/card-share-api";
import {
  canResendRecipient,
  isBatchSettled,
  type CardShareBatch,
  type CardShareRecipient,
} from "@/lib/card-share-types";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { cn } from "@/lib/utils";

export type ShareBatchStatusProps = {
  batch: CardShareBatch;
  /** Called after a poll or a resend returns a newer batch. */
  onChange?: (batch: CardShareBatch) => void;
  /** Poll until every recipient settles. Default true. */
  autoPoll?: boolean;
  className?: string;
};

const HEADER_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const ROW_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

const MAX_POLL_ATTEMPTS = 40;
const MAX_POLL_DELAY_MS = 30000;
const INITIAL_POLL_DELAY_MS = 5000;
const MAX_CONSECUTIVE_POLL_FAILURES = 3;

/** Status pill copy + StatusBadge variant for one recipient. */
export function recipientStatusLabel(recipient: CardShareRecipient): {
  label: string;
  variant: "connected" | "neutral" | "danger";
} {
  const delivery = recipient.deliveryStatus;
  if (delivery === "READ") {
    return { label: "Read", variant: "connected" };
  }
  if (delivery === "DELIVERED") {
    return { label: "Delivered", variant: "connected" };
  }
  if (delivery === "SENT") {
    return { label: "Sent", variant: "neutral" };
  }
  if (delivery === "FAILED") {
    return { label: "Failed", variant: "danger" };
  }

  switch (recipient.dispatchStatus) {
    case "PENDING":
      return { label: "Queued", variant: "neutral" };
    case "PROCESSING":
      return { label: "Sending", variant: "neutral" };
    case "RETRYING":
      return { label: "Retrying", variant: "neutral" };
    case "DISPATCHED":
      return { label: "Sent", variant: "neutral" };
    case "FAILED":
      return { label: "Failed", variant: "danger" };
    default:
      return { label: "Queued", variant: "neutral" };
  }
}

/** Delivery + resend UI for one share batch, polling until every recipient settles. */
export function ShareBatchStatus({
  batch,
  onChange,
  autoPoll = true,
  className,
}: ShareBatchStatusProps): JSX.Element {
  const [resendBusyId, setResendBusyId] = useState<string | null>(null);
  const [pollingStopped, setPollingStopped] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const settled = isBatchSettled(batch);

  useEffect(() => {
    if (!autoPoll || settled) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let delay = INITIAL_POLL_DELAY_MS;
    let attempts = 0;
    let consecutiveFailures = 0;

    setPollingStopped(false);

    const schedule = () => {
      timeoutId = setTimeout(run, delay);
    };

    /** Give up quietly, but tell the UI so it can stop looking live. */
    const giveUp = () => {
      if (!cancelled) {
        setPollingStopped(true);
      }
    };

    const run = () => {
      if (cancelled) {
        return;
      }
      attempts += 1;
      getCardShareBatch(batch.id)
        .then((updated) => {
          if (cancelled) {
            return;
          }
          consecutiveFailures = 0;
          onChangeRef.current?.(updated);
          if (isBatchSettled(updated)) {
            return;
          }
          if (attempts >= MAX_POLL_ATTEMPTS) {
            giveUp();
            return;
          }
          delay = Math.min(delay * 1.5, MAX_POLL_DELAY_MS);
          schedule();
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          consecutiveFailures += 1;
          if (
            consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES ||
            attempts >= MAX_POLL_ATTEMPTS
          ) {
            giveUp();
            return;
          }
          delay = Math.min(delay * 1.5, MAX_POLL_DELAY_MS);
          schedule();
        });
    };

    schedule();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [batch.id, settled, autoPoll]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const updated = await getCardShareBatch(batch.id);
      if (mountedRef.current) {
        onChangeRef.current?.(updated);
        setPollingStopped(false);
      }
    } catch (error) {
      logUiError("Could not refresh share status", error);
      toast.error(friendlyErrorMessages.load);
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  };

  const handleResend = async (recipientId: string) => {
    setResendBusyId(recipientId);
    try {
      await resendShareRecipient(batch.id, recipientId);
      const updated = await getCardShareBatch(batch.id);
      if (mountedRef.current) {
        onChangeRef.current?.(updated);
      }
    } catch (error) {
      logUiError("Could not resend card share", error);
      toast.error(
        error instanceof ApiError && error.message
          ? error.message
          : friendlyErrorMessages.save,
      );
    } finally {
      if (mountedRef.current) {
        setResendBusyId(null);
      }
    }
  };

  const total = batch.recipients.length;
  const deliveredCount = batch.recipients.filter(
    (recipient) =>
      recipient.deliveryStatus === "DELIVERED" ||
      recipient.deliveryStatus === "READ",
  ).length;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {deliveredCount} of {total} delivered
        </p>
        <p className="text-xs text-muted-foreground">
          {HEADER_DATE_FORMATTER.format(new Date(batch.createdAt))}
        </p>
      </div>
      {batch.note ? (
        <p className="text-sm italic text-muted-foreground">"{batch.note}"</p>
      ) : null}
      {pollingStopped && !settled ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary px-3 py-2">
          <p className="text-xs text-muted-foreground">
            We&apos;ve stopped checking for updates on this send.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            onClick={() => void handleRefresh()}
          >
            {isRefreshing ? "Checking…" : "Check again"}
          </Button>
        </div>
      ) : null}
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recipients on this share.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {batch.recipients.map((recipient) => {
            const status = recipientStatusLabel(recipient);
            const timestamp =
              recipient.readAt ??
              recipient.deliveredAt ??
              recipient.sentAt ??
              recipient.failedAt;
            const busy = resendBusyId === recipient.id;
            const canResend = canResendRecipient(recipient);
            const showError = Boolean(recipient.lastDispatchError) && canResend;
            return (
              <li
                key={recipient.id}
                className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {recipient.countryCode} {recipient.phone}
                    </span>
                    <StatusBadge variant={status.variant}>
                      {status.label}
                    </StatusBadge>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {timestamp ? (
                      <span className="text-xs text-muted-foreground">
                        {ROW_DATE_FORMATTER.format(new Date(timestamp))}
                      </span>
                    ) : null}
                    {canResend ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleResend(recipient.id)}
                      >
                        {busy ? "Resending…" : "Resend"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {showError ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {recipient.lastDispatchError}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

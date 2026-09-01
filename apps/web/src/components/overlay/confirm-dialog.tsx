"use client";

import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/primitives/button";
import { Dialog, DialogClose } from "./dialog";

/**
 * ConfirmDialog — the inline confirmation a destructive action gets instead of a toast.
 *
 * §8D.1 splits the two: a *reversible* action is confirmed after the fact by a toast
 * carrying an Undo; a *destructive* one is confirmed before the fact, here, because
 * there is nothing to undo afterwards. Copy follows the §6.10 panel anatomy — overline,
 * `--text-h3` title, body detail — so the two surfaces a user meets when
 * something is about to go wrong, or already has, read as the same system.
 *
 * `consequence` is the slot that makes E-41 possible: deleting a profile field must state
 * **how many cards use it** before the user commits, in words. T25 passes that sentence
 * in; this component guarantees it is rendered above the action row and inside the
 * dialog's announced content.
 */

export type ConfirmTone = "destructive" | "default";

export interface ConfirmDialogProps {
  trigger?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Overrides the tone's default kicker. */
  overline?: ReactNode;
  title: ReactNode;
  /** What actually happens. Plain and specific — nouns and numbers, not adjectives. */
  detail: ReactNode;
  /** The blast radius, in words. E-41: "3 cards use this field. They will lose it." */
  consequence?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  /** In-flight confirm. The button announces busy and swallows a second click (E-43). */
  busy?: boolean;
}

const CONSEQUENCE_TONES: Record<ConfirmTone, string> = {
  destructive: "bg-danger-wash text-danger",
  default: "bg-warning-wash text-warning-ink",
};

export function ConfirmDialog({
  trigger,
  open,
  defaultOpen,
  onOpenChange,
  overline = "Confirm",
  title,
  detail,
  consequence,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "destructive",
  onConfirm,
  busy = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      trigger={trigger}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      overline={overline}
      title={title}
      size="sm"
      // Cancel is the close affordance, so a second one in the corner is noise.
      hideClose
      // Radix would otherwise focus the first control in the content. On a destructive
      // dialog that is one stray Enter away from data loss, so focus starts on the safe
      // choice and the user has to travel to reach the irreversible one.
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        cancelRef.current?.focus();
      }}
      footer={
        <>
          <DialogClose asChild>
            <Button ref={cancelRef} variant="secondary">
              {cancelLabel}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant={tone === "destructive" ? "destructive" : "primary"}
              loading={busy}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </DialogClose>
        </>
      }
    >
      <p className="text-base text-ink">{detail}</p>

      {consequence ? (
        <p
          data-confirm-consequence=""
          className={cn(
            "mt-4 rounded-sm px-3 py-2 text-sm",
            CONSEQUENCE_TONES[tone],
          )}
        >
          {consequence}
        </p>
      ) : null}
    </Dialog>
  );
}

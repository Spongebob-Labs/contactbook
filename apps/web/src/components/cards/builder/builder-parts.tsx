import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Stable ids for newly added rows; falls back where randomUUID is unavailable. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-[13px] font-medium text-foreground"
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className="text-[12px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function SectionIntro({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        {hint ? (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * One repeatable entry — a contact method, social link or block.
 *
 * Hiding is offered alongside deleting because taking a phone number off a
 * published card is usually temporary, and re-typing it is the kind of friction
 * that makes people leave stale details up instead.
 */
export function RepeatableRow({
  children,
  visible,
  onToggleVisible,
  onRemove,
  dragHandle,
  className,
}: {
  children: ReactNode;
  visible: boolean;
  onToggleVisible: () => void;
  onRemove: () => void;
  dragHandle?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background/60 p-3 transition-opacity duration-150",
        !visible && "opacity-55",
        className,
      )}
    >
      <div className="mb-2.5 flex items-center gap-1">
        {dragHandle ?? null}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? "Hide from card" : "Show on card"}
          title={visible ? "Hide from card" : "Show on card"}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-bg-hover hover:text-foreground"
        >
          {visible ? (
            <Eye className="h-4 w-4" aria-hidden="true" />
          ) : (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          title="Remove"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-bg-hover hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

/**
 * Typed as plain button props rather than a dnd-kit shape: the caller spreads
 * both `attributes` and `listeners` in, and every key either library produces
 * (role, tabIndex, aria-*, onPointerDown, onKeyDown) is already a button prop.
 * Keeps this file free of a drag-library import.
 */
export function DragHandle(props: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="button"
      aria-label="Reorder"
      className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-bg-hover hover:text-foreground active:cursor-grabbing"
      {...props}
    >
      <GripVertical className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
      {children}
    </p>
  );
}

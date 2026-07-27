import {
  Copy,
  Link2,
  MessageCircle,
  QrCode,
  Share2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ShareSheetOptionId =
  | "whatsapp"
  | "messages"
  | "copy"
  | "qr"
  | "native";

type ShareSheetProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (id: ShareSheetOptionId) => void;
  title?: string;
  className?: string;
};

const OPTIONS: Array<{
  id: ShareSheetOptionId;
  label: string;
  icon: typeof Share2;
}> = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "copy", label: "Copy Link", icon: Copy },
  { id: "qr", label: "Share QR", icon: QrCode },
  { id: "native", label: "More…", icon: Share2 },
];

export function ShareSheet({
  open,
  onClose,
  onSelect,
  title = "Share card",
  className,
}: ShareSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close share sheet"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 w-full max-w-md overflow-hidden rounded-t-xl border border-border bg-surface sm:rounded-xl overlay-enter",
          className,
        )}
      >
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Share via</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-bg-hover hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="divide-y divide-border border-t border-border">
          {OPTIONS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-base font-medium text-foreground transition-colors duration-150 hover:bg-bg-hover"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
                  <Icon className="h-4 w-4 text-foreground" aria-hidden="true" />
                </span>
                <span className="flex-1">{label}</span>
                <Link2 className="h-4 w-4 text-[#9CA3AF]" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-border p-4">
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-center"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

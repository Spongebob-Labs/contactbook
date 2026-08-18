import {
  ChevronRight,
  Copy,
  Download,
  QrCode,
  Share2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ShareSheetOptionId =
  | "copy-link"
  | "native-share"
  | "save-contact"
  | "download-qr";

const OPTION_DETAIL: Record<
  ShareSheetOptionId,
  { label: string; description: string; icon: LucideIcon }
> = {
  "copy-link": {
    label: "Copy link",
    description: "Paste it anywhere",
    icon: Copy,
  },
  "native-share": {
    label: "Share…",
    description: "Send via any app on this device",
    icon: Share2,
  },
  "save-contact": {
    label: "Save contact",
    description: "Download a .vcf file",
    icon: Download,
  },
  "download-qr": {
    label: "Download QR",
    description: "PNG for print or an email signature",
    icon: QrCode,
  },
};

const DEFAULT_OPTIONS: ShareSheetOptionId[] = ["copy-link", "save-contact"];

type ShareSheetProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (id: ShareSheetOptionId) => void;
  /** Which rows to show. Callers filter by what they can actually do. */
  options?: ShareSheetOptionId[];
  title?: string;
  className?: string;
};

export function ShareSheet({
  open,
  onClose,
  onSelect,
  options = DEFAULT_OPTIONS,
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
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
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
          {options.map((id) => {
            const { label, description, icon: Icon } = OPTION_DETAIL[id];
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-bg-hover"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                    <Icon
                      className="h-4 w-4 text-foreground"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium text-foreground">
                      {label}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {description}
                    </span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-[#9CA3AF]"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
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

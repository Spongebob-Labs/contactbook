import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Smartphone, X } from "lucide-react";
import { LiveCardPreview } from "@/components/cards/live-card-preview";
import type {
  ContactCardFields,
  ContactCardTemplate,
  ContactCardTheme,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type MobileCardPreviewProps = {
  open: boolean;
  onClose: () => void;
  fields: ContactCardFields;
  theme?: ContactCardTheme;
  template?: ContactCardTemplate;
  title?: string;
  onSaveContact?: () => void;
  onShareCard?: () => void;
  className?: string;
};

/**
 * Scales children to fit the phone screen — no scrollbar, one-glance view.
 * Used for Scan (fixed aspect card). Connect uses full-bleed stretch instead.
 */
function FitToPhoneScreen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const update = () => {
      const availableH = viewport.clientHeight;
      const availableW = viewport.clientWidth;
      const neededH = content.offsetHeight;
      const neededW = content.offsetWidth;
      if (neededH <= 0 || availableH <= 0) {
        setScale(1);
        return;
      }
      const next = Math.min(
        1,
        availableH / neededH,
        availableW / Math.max(neededW, 1),
      );
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div
      ref={viewportRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
    >
      <div
        className="absolute left-1/2 top-1/2 w-full"
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <div ref={contentRef} className="w-full">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Full-viewport phone preview — ~9:19.5 device frame.
 * Connect paints edge-to-edge; Scan stays scale-fitted in one glance.
 */
export function MobileCardPreview({
  open,
  onClose,
  fields,
  theme,
  template,
  title = "Mobile preview",
  onSaveContact,
  onShareCard,
  className,
}: MobileCardPreviewProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const isScan = template === "scan";

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const templateLabel = isScan ? "Scan" : "Connect";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col bg-[#0B1220]",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p
            id={titleId}
            className="flex items-center gap-2 text-sm font-semibold text-white"
          >
            <Smartphone className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
            <span className="truncate">{title}</span>
          </p>
          <p className="mt-0.5 text-xs text-white/55">
            {templateLabel} · how your card looks on a phone
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="Close mobile preview"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Close
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 py-3 sm:px-6 sm:py-4">
        <button
          type="button"
          aria-label="Dismiss preview"
          className="absolute inset-0 cursor-default"
          onClick={onClose}
        />

        <div
          className="relative z-10 overlay-enter"
          style={{
            height: "min(88dvh, 860px)",
            width: "min(400px, calc(min(88dvh, 860px) * 9 / 19.5))",
          }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="flex h-full w-full flex-col rounded-[42px] border-[3px] border-[#1F2937] bg-[#111827] p-[10px] shadow-[0_28px_90px_rgba(0,0,0,0.5)] sm:rounded-[46px] sm:p-3">
            <div
              className={cn(
                "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] sm:rounded-[36px]",
                isScan ? "bg-[#FAFAFA]" : "bg-transparent",
              )}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-7 items-start justify-center pt-1.5"
                aria-hidden="true"
              >
                <span className="h-3.5 w-20 rounded-full bg-[#111827]" />
              </div>

              {isScan ? (
                <div className="min-h-0 flex-1 overflow-hidden px-2.5 pb-1 pt-7">
                  <FitToPhoneScreen>
                    <LiveCardPreview
                      fields={fields}
                      theme={theme}
                      template={template}
                      onSaveContact={onSaveContact}
                      onShareCard={onShareCard}
                      className="!mx-auto !max-w-[300px] !shadow-none"
                    />
                  </FitToPhoneScreen>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <LiveCardPreview
                    fields={fields}
                    theme={theme}
                    template={template}
                    fillPhone
                    onSaveContact={onSaveContact}
                    onShareCard={onShareCard}
                    className="!mx-auto h-full !max-w-none !shadow-none"
                  />
                </div>
              )}

              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-2 pt-0.5"
                aria-hidden="true"
              >
                <span
                  className={cn(
                    "h-1 w-24 rounded-full",
                    isScan ? "bg-[#111827]/35" : "bg-black/25",
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export function DetailGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-x-6 gap-y-3.5 text-sm sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) {
    return null;
  }
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block break-words text-sm font-medium leading-5 text-foreground">
        {value}
      </span>
    </div>
  );
}

export function LinkedDetailRow({
  label,
  value,
  isLinkable,
}: {
  label: string;
  value?: string | null;
  isLinkable: (value: string) => boolean;
}) {
  if (!value) {
    return null;
  }
  if (!isLinkable(value)) {
    return <DetailRow label={label} value={value} />;
  }
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex min-w-0 items-center gap-1.5 break-all text-sm font-medium text-primary hover:underline"
      >
        <span className="min-w-0 break-all">{value}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </a>
    </div>
  );
}

export function EmptyFieldsState({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-3 text-sm text-muted-foreground",
        className,
      )}
    >
      {label}
    </div>
  );
}

export function RecordPanel({
  badge,
  children,
  media,
  subtitle,
  title,
  className,
}: {
  badge?: string;
  children: ReactNode;
  media?: ReactNode;
  subtitle?: string | null;
  title?: string | null;
  className?: string;
}) {
  const hasHeader = Boolean(title || subtitle || badge || media);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-background/45 p-4 backdrop-blur-sm md:p-5",
        className,
      )}
    >
      {hasHeader && (
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-border/60 pb-3">
          <div className="min-w-0">
            {badge && (
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {badge}
              </span>
            )}
            {title && (
              <h3
                className={cn(
                  "truncate text-base font-semibold tracking-tight text-foreground",
                  badge && "mt-1",
                )}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {media && <div className="shrink-0">{media}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

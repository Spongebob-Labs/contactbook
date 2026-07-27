import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Panel({ className, children, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type PanelHeaderProps = {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function PanelHeader({ title, action, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "mb-4 flex items-center justify-between gap-3",
        className,
      )}
    >
      <h2 className="title-section">{title}</h2>
      {action ? (
        <div className="text-sm text-muted-foreground">{action}</div>
      ) : null}
    </div>
  );
}

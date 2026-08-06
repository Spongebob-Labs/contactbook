import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CompletionRingProps = {
  percent: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
};

export function CompletionRing({
  percent,
  size = 120,
  strokeWidth = 6,
  className,
  label = "Completed",
}: CompletionRingProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const next = circumference - (clamped / 100) * circumference;
    const frame = window.requestAnimationFrame(() => setOffset(next));
    return () => window.cancelAnimationFrame(frame);
  }, [clamped, circumference]);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-bold tracking-[-0.01em] text-foreground">
          {clamped}%
        </span>
        <span className="mt-0.5 text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

type CompletionChecklistProps = {
  items: Array<{ label: string; done: boolean }>;
  className?: string;
};

export function CompletionChecklist({
  items,
  className,
}: CompletionChecklistProps) {
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-start gap-2.5 text-sm">
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
              item.done
                ? "border-foreground bg-foreground text-primary-foreground"
                : "border-border bg-surface",
            )}
            aria-hidden="true"
          >
            {item.done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
          </span>
          <span
            className={cn(
              item.done ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

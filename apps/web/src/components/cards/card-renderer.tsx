import { useMemo, type ComponentType, type ReactNode } from "react";
import { CardFaceLayout } from "@/components/cards/render/card-face-layout";
import { CompactLayout } from "@/components/cards/render/compact-layout";
import { StackLayout } from "@/components/cards/render/stack-layout";
import type { CardLayoutProps } from "@/components/cards/render/card-render-parts";
import type { CardLayout, CardSnapshot } from "@/lib/card-schema";
import { resolveCardTokens } from "@/lib/card-themes";
import { cn } from "@/lib/utils";

/**
 * The one component that draws a card.
 *
 * The builder's live preview and the public `/c/:slug` page both mount *this* —
 * same component, two call sites. That is the whole point: a preview that
 * renders through a different code path than the published page is a preview
 * that will eventually lie, and the person it lies to is holding a printed QR.
 *
 * It owns no data fetching, no app state and no routing. Give it a snapshot.
 */
export type CardRendererProps = {
  snapshot: CardSnapshot;
  /**
   * Whether links navigate and actions fire. The builder passes false so that
   * clicking the preview cannot leave the editor.
   */
  interactive?: boolean;
  /** Rendered by layouts that show a QR; phase 4 supplies a real one. */
  qr?: ReactNode;
  onSaveContact?: () => void;
  className?: string;
};

const LAYOUTS: Record<CardLayout, ComponentType<CardLayoutProps>> = {
  stack: StackLayout,
  cardface: CardFaceLayout,
  compact: CompactLayout,
};

export function CardRenderer({
  snapshot,
  interactive = true,
  qr,
  onSaveContact,
  className,
}: CardRendererProps) {
  const tokens = useMemo(
    () => resolveCardTokens(snapshot.theme),
    [snapshot.theme],
  );

  const Layout = LAYOUTS[snapshot.layout] ?? StackLayout;

  return (
    <div
      className={cn("relative min-h-full w-full", className)}
      style={{ background: tokens.background, fontFamily: tokens.fontBody }}
    >
      {tokens.overlay ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: tokens.overlay }}
          aria-hidden="true"
        />
      ) : null}

      <div className="relative">
        <Layout
          snapshot={snapshot}
          tokens={tokens}
          interactive={interactive}
          qr={qr}
          onSaveContact={onSaveContact}
        />
      </div>
    </div>
  );
}

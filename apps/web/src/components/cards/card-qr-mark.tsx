import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Deterministic QR-style mark for Connect/Scan previews.
 * Shared by live Scan + gallery Scan thumbs so dashboard matches detail.
 * Quiet zone + finder/timing/alignment patterns read as a real QR at small sizes.
 */
export function CardQrMark({
  seed,
  size = 118,
  className,
  labelled = true,
}: {
  seed: string;
  size?: number;
  className?: string;
  /** When false, decorative-only (gallery thumbs). */
  labelled?: boolean;
}) {
  const modules = useMemo(() => {
    // Version-ish density: 29 modules reads as a real QR at thumb + live sizes.
    const dim = 29;
    const grid: boolean[][] = Array.from({ length: dim }, () =>
      Array.from({ length: dim }, () => false),
    );

    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    const nextBit = () => {
      hash ^= hash << 13;
      hash ^= hash >>> 17;
      hash ^= hash << 5;
      return (hash >>> 0) % 2 === 0;
    };

    const paintFinder = (ox: number, oy: number) => {
      for (let y = 0; y < 7; y += 1) {
        for (let x = 0; x < 7; x += 1) {
          const edge = x === 0 || y === 0 || x === 6 || y === 6;
          const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          grid[oy + y][ox + x] = edge || core;
        }
      }
    };

    const paintAlignment = (cx: number, cy: number) => {
      for (let y = -2; y <= 2; y += 1) {
        for (let x = -2; x <= 2; x += 1) {
          const edge = Math.abs(x) === 2 || Math.abs(y) === 2;
          const core = x === 0 && y === 0;
          grid[cy + y][cx + x] = edge || core;
        }
      }
    };

    paintFinder(0, 0);
    paintFinder(dim - 7, 0);
    paintFinder(0, dim - 7);

    // Timing patterns (row 6 / col 6) — classic QR silhouette.
    for (let i = 8; i < dim - 8; i += 1) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Alignment pattern near bottom-right (avoid finder zones).
    paintAlignment(dim - 7, dim - 7);

    const reserved = (x: number, y: number) => {
      const inTopLeft = x < 9 && y < 9;
      const inTopRight = x >= dim - 8 && y < 9;
      const inBottomLeft = x < 9 && y >= dim - 8;
      const inTiming = x === 6 || y === 6;
      const inAlign =
        x >= dim - 9 && x <= dim - 5 && y >= dim - 9 && y <= dim - 5;
      return inTopLeft || inTopRight || inBottomLeft || inTiming || inAlign;
    };

    for (let y = 0; y < dim; y += 1) {
      for (let x = 0; x < dim; x += 1) {
        if (reserved(x, y)) continue;
        grid[y][x] = nextBit();
      }
    }

    return { dim, grid };
  }, [seed]);

  // Quiet zone: ~1 module of white margin so the mark doesn’t look clipped.
  const quiet = size * 0.06;
  const drawable = size - quiet * 2;
  const cell = drawable / modules.dim;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("block bg-white", className)}
      role={labelled ? "img" : "presentation"}
      aria-label={labelled ? "Share QR code" : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      <rect width={size} height={size} fill="#FFFFFF" />
      {modules.grid.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect
              key={`${x}-${y}`}
              x={quiet + x * cell}
              y={quiet + y * cell}
              width={cell}
              height={cell}
              fill="#0B1220"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

/** Seed string aligned across live preview + gallery thumbs. */
export function cardQrSeed(parts: {
  name: string;
  email: string;
  phone: string;
  company: string;
  website?: string;
}) {
  return [
    parts.name,
    parts.email,
    parts.phone,
    parts.company,
    parts.website ?? "",
  ].join("|");
}

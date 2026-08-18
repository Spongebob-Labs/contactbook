import { useMemo } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

/**
 * A genuinely scannable QR.
 *
 * Replaces the decorative pattern in `card-qr-mark.tsx`, which drew finder
 * squares and random fill that looked like a QR and encoded nothing. Anything a
 * stranger might point a phone at must come from here.
 */

/**
 * Four modules of quiet zone is the ISO minimum, and scanners genuinely fail
 * without it. The old decorative mark used the equivalent of one.
 */
const QUIET_ZONE_MODULES = 4;

export function CardQr({
  url,
  size = 160,
  className,
  /** Dark module colour. Keep the contrast high; scanners are unforgiving. */
  foreground = "#0B1220",
  background = "#FFFFFF",
}: {
  url: string;
  size?: number;
  className?: string;
  foreground?: string;
  background?: string;
}) {
  const grid = useMemo(() => {
    if (!url.trim()) {
      return null;
    }
    try {
      // Level M (~15% recovery) is the right trade for a link this short:
      // enough resilience for a printed pass without inflating the module
      // count to the point where it stops scanning at small sizes.
      const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
      return modules;
    } catch {
      return null;
    }
  }, [url]);

  if (!grid) {
    return null;
  }

  const count = grid.size;
  const total = count + QUIET_ZONE_MODULES * 2;
  const cell = size / total;
  const offset = QUIET_ZONE_MODULES * cell;

  const rects: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < count; y += 1) {
    for (let x = 0; x < count; x += 1) {
      if (grid.data[y * count + x]) {
        rects.push({ x, y });
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("block", className)}
      role="img"
      aria-label="QR code linking to this card"
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill={background} />
      {rects.map(({ x, y }) => (
        <rect
          key={`${x}-${y}`}
          x={offset + x * cell}
          y={offset + y * cell}
          width={cell}
          height={cell}
          fill={foreground}
        />
      ))}
    </svg>
  );
}

/**
 * PNG data URL of the same code — for the Download menu, so the QR can go on a
 * printed card, an email signature or an event badge.
 */
export async function qrPngDataUrl(url: string, size = 1024): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: QUIET_ZONE_MODULES,
    errorCorrectionLevel: "M",
    color: { dark: "#0B1220FF", light: "#FFFFFFFF" },
  });
}

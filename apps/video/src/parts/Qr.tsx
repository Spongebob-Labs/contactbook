import QRCode from "qrcode";
import { useMemo } from "react";

import { T } from "../theme";

/**
 * A real QR code, drawn as a grid rather than rasterised.
 *
 * It encodes the actual card URL, so the code in the hero film scans and lands on the real
 * page. A decorative lookalike would have been half the work, and is exactly the detail that
 * quietly tells a viewer the product is a mockup.
 *
 * Drawn as SVG rects on integer module coordinates: a canvas raster scaled to fit softens the
 * module edges, and a soft-edged QR is one that decoders start refusing at an angle.
 */
export function Qr({ text, size, quiet = 2 }: { text: string; size: number; quiet?: number }) {
  const { modules, count } = useMemo(() => {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    return { modules: qr.modules.data as unknown as Uint8Array, count: qr.modules.size };
  }, [text]);

  const total = count + quiet * 2;
  const cell = size / total;

  const rects = [];
  for (let y = 0; y < count; y += 1) {
    for (let x = 0; x < count; x += 1) {
      if (!modules[y * count + x]) continue;
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={(x + quiet) * cell}
          y={(y + quiet) * cell}
          width={cell}
          height={cell}
          fill={T.ink}
        />,
      );
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* The plate stays opaque white whatever the card's ground: many decoders reject an
          inverted or tinted symbol, and the product's own renderer holds the same rule. */}
      <rect x={0} y={0} width={size} height={size} rx={cell * 1.5} fill={T.white} />
      {rects}
    </svg>
  );
}

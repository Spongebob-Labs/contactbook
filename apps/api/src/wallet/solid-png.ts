import { deflateSync } from "node:zlib";
import { crc32 } from "./zip-writer";

/**
 * Generates a solid-colour PNG.
 *
 * Wallet rejects a pass without `icon.png`, and there is no brand artwork to
 * embed yet. Deriving a plain icon from the card's accent colour keeps the
 * pipeline whole and looks deliberate rather than broken; swap it for real
 * assets via config once the client supplies them.
 *
 * PNG and ZIP share CRC-32, so this reuses the one in `zip-writer`.
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);

  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([length, typeAndData, checksum]);
}

export type Rgb = { r: number; g: number; b: number };

/** "#C4A882" -> { r, g, b }. Falls back to a neutral grey on bad input. */
export function hexToRgb(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    return { r: 27, g: 36, b: 48 };
  }
  const value = match[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

export function solidPng(size: number, color: Rgb): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // colour type 2 = truecolour RGB
  ihdr.writeUInt8(0, 10); // deflate
  ihdr.writeUInt8(0, 11); // adaptive filtering
  ihdr.writeUInt8(0, 12); // no interlace

  // Each scanline is prefixed with its filter type; 0 means "none".
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const pixel = rowStart + 1 + x * 3;
      raw[pixel] = color.r;
      raw[pixel + 1] = color.g;
      raw[pixel + 2] = color.b;
    }
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

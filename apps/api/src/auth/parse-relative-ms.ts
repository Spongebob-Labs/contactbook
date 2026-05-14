const REL = /^(\d+)(ms|s|m|h|d)$/i;

/**
 * Parses strings like `30d`, `15m`, `7d` into milliseconds (Nest/JWT-style).
 */
export function parseRelativeMs(input: string, fallbackMs: number): number {
  const m = REL.exec(input.trim());
  if (!m) {
    return fallbackMs;
  }
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  const unit: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  const mult = unit[u];
  return mult !== undefined ? n * mult : fallbackMs;
}

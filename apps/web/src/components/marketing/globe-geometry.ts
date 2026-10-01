import { globeLandVectors } from "./globe-land";

/**
 * The globe's geometry — pure functions, shared by the server-rendered still in
 * `world-globe.tsx` and its canvas loop, so the first paint and the first canvas frame are the
 * same picture.
 *
 * Orthographic projection, the reader looking down −z. A point is rotated three times: spun
 * about the pole so the centre longitude faces the reader, tipped toward the reader by the
 * camera's elevation, then leaned in the picture plane by the axis's roll. All of it is one 3×3
 * matrix per frame, and every land dot is a precomputed unit vector — so a frame is one
 * multiply per dot and nothing else.
 */

const DEG = Math.PI / 180;

/** The camera sits 18° above the equator, tipping the north — where all four cities are — in. */
export const GLOBE_ELEVATION_DEG = 18;
/** The axis leans 16° in the picture plane, north pole to the right, the way a desk globe does. */
export const GLOBE_ROLL_DEG = -16;
/**
 * The composed still: the centre longitude at which all four cities are on the near side at
 * once (London and Dubai face the reader; New York and Singapore sit just inside either limb).
 * The four span 178° of longitude, so no angle shows them all face-on — this one maximises the
 * least visible of them. It is also where the rotation starts.
 */
export const GLOBE_STILL_LON = 22;
/** One revolution — about 10°/s. Calm enough to sit beside copy, quick enough to read as turning. */
export const GLOBE_REVOLUTION_S = 36;
/**
 * A city faces the reader while its depth — its dot with the view direction, so its closeness to
 * the disc's centre on screen — is at least this. Depth, not longitude: London at 51°N never gets
 * as close to the centre as Dubai does at 25°N, and a longitude rule lit London while New York
 * visibly sat nearer the middle.
 */
export const GLOBE_FACING_Z = 0.55;
/** The sphere's radius as a fraction of its stage's height. */
export const GLOBE_RADIUS = 0.46;
/** The still's square box, in sphere radii from the centre — room for the atmosphere. */
export const GLOBE_FRAME = 1.1;
/** A land dot's radius at the centre of the disc, in sphere radii. */
export const GLOBE_DOT = 0.0092;
/** How far the atmosphere reaches past the limb, in sphere radii. */
export const GLOBE_GLOW = 0.07;

/** Depth bands. One path and one fill per band, so a frame costs eight fills, not 2,300. */
export const GLOBE_BANDS = 8;

export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

/**
 * World → screen for a given centre longitude. Rows are screen-right, screen-DOWN and toward the
 * reader, so `z > 0` is the near hemisphere and `(x, y)` are in sphere radii from the centre.
 */
export function viewMatrix(centreLonDeg: number): Mat3 {
  const l = centreLonDeg * DEG;
  const e = GLOBE_ELEVATION_DEG * DEG;
  const r = GLOBE_ROLL_DEG * DEG;
  const cl = Math.cos(l), sl = Math.sin(l);
  const ce = Math.cos(e), se = Math.sin(e);
  const cr = Math.cos(r), sr = Math.sin(r);
  return [
    cl * cr + sl * se * sr, -ce * sr, -sl * cr + cl * se * sr,
    -(cl * sr - sl * se * cr), -(ce * cr), -(-sl * sr - cl * se * cr),
    sl * ce, se, cl * ce,
  ];
}

export function latLonVector(lat: number, lon: number): [number, number, number] {
  const la = lat * DEG, lo = lon * DEG;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

export function project(m: Mat3, v: readonly [number, number, number]): { x: number; y: number; z: number } {
  return {
    x: m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    y: m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    z: m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  };
}

/** Degrees folded into (−180, 180]. */
export function wrapDeg(d: number): number {
  const w = ((((d + 180) % 360) + 360) % 360) - 180;
  return w === -180 ? 180 : w;
}

/**
 * Which city holds the highlight. A city can only TAKE it while it is coming round — west of the
 * centre meridian, since the surface drifts west to east (left to right) as the Earth really
 * turns — and keeps it until a city coming round faces the reader more squarely, or it sinks
 * below `GLOBE_FACING_Z` toward the limb. So at most one is lit, each hand-off happens once, and
 * a city already past its best never flickers on for a moment at the start. −1 over open ocean.
 */
export function facingCity(
  cities: readonly { lon: number }[],
  depths: readonly number[],
  centreLonDeg: number,
  current: number,
): number {
  let best = -1;
  let bestZ = GLOBE_FACING_Z;
  cities.forEach((c, i) => {
    const z = depths[i]!;
    const comingRound = wrapDeg(c.lon - centreLonDeg) < 0;
    if (z >= bestZ && (comingRound || i === current)) {
      best = i;
      bestZ = z;
    }
  });
  return best;
}

/** How fully a facing city is named: nothing at the threshold, all of it 0.2 of depth later. */
export function facingLevel(z: number): number {
  return smoothstep(GLOBE_FACING_Z, GLOBE_FACING_Z + 0.2, z);
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * A dot's depth band. Square-root spacing gives the limb — where depth changes fastest and the
 * dots foreshorten — the finer steps.
 */
export function bandOf(z: number): number {
  return Math.min(GLOBE_BANDS - 1, Math.floor(Math.sqrt(z) * GLOBE_BANDS));
}

/**
 * How a band draws: dots fade and shrink toward the limb (GitHub's per-dot fade, which is also
 * what keeps the crowded edge from shimmering), and flatten radially as the surface turns away.
 */
export function bandStyle(band: number): { alpha: number; size: number; squash: number } {
  const t = (band + 0.5) / GLOBE_BANDS;
  const z = t * t;
  return { alpha: 0.18 + 0.82 * Math.pow(z, 0.6), size: 0.55 + 0.45 * t, squash: Math.max(z, 0.35) };
}

/**
 * Where a city's name sits relative to its pin, as a translateX percentage of the name's own
 * width: centred under a pin near the middle of the disc, sliding inward as the pin nears either
 * limb, so a name is never pushed off the sphere's side of the card.
 */
export function labelShift(x: number): number {
  const s = smoothstep(0.35, 0.8, Math.abs(x)) * Math.sign(x);
  return -50 - 44 * s;
}

let land: Float32Array | null = null;
/** The land dots, decoded once per page (server or client). */
export function landVectors(): Float32Array {
  land ??= globeLandVectors();
  return land;
}

/** Units per sphere radius in the still's SVG — integers at this scale are a third of a CSS pixel. */
export const STILL_UNIT = 500;

/**
 * The still as SVG paths, one per depth band, in `STILL_UNIT`s from the sphere's centre. Each dot
 * is a zero-length (or, near the limb, a short tangential) round-capped segment — the flat map's
 * `stroke-dasharray` trick — so ~2,300 dots are eight elements, not 2,300.
 */
export function stillBands(m: Mat3): { d: string; width: number; alpha: number }[] {
  const v = landVectors();
  const parts: string[][] = Array.from({ length: GLOBE_BANDS }, () => []);
  const cur: [number, number][] = Array.from({ length: GLOBE_BANDS }, () => [0, 0]);
  const styles = Array.from({ length: GLOBE_BANDS }, (_, k) => bandStyle(k));
  for (let i = 0; i < v.length; i += 3) {
    const vx = v[i]!, vy = v[i + 1]!, vz = v[i + 2]!;
    const z = m[6] * vx + m[7] * vy + m[8] * vz;
    if (z <= 0.02) continue;
    const x = m[0] * vx + m[1] * vy + m[2] * vz;
    const y = m[3] * vx + m[4] * vy + m[5] * vz;
    const k = bandOf(z);
    const s = styles[k]!;
    const r = GLOBE_DOT * STILL_UNIT * s.size;
    // Round wherever the flattening is under 40% — invisible at a dot's size, and a third the bytes.
    const half = s.squash >= 0.6 ? 0 : r * (1 - s.squash);
    const len = Math.hypot(x, y) || 1;
    const tx = (-y / len) * half, ty = (x / len) * half;
    const sx = Math.round((x * STILL_UNIT) - tx), sy = Math.round((y * STILL_UNIT) - ty);
    const c = cur[k]!;
    const dx = Math.round(2 * tx), dy = Math.round(2 * ty);
    parts[k]!.push(`m${sx - c[0]} ${sy - c[1]}${dx === 0 && dy === 0 ? "h0" : `l${dx} ${dy}`}`);
    c[0] = sx + dx;
    c[1] = sy + dy;
  }
  return parts.map((p, k) => {
    const s = styles[k]!;
    return { d: p.join(""), width: 2 * GLOBE_DOT * STILL_UNIT * s.size * s.squash, alpha: s.alpha };
  });
}

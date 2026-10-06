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

/** The camera sits 18° above the equator, tipping the north — where most of the cities are — in. */
export const GLOBE_ELEVATION_DEG = 18;
/** The axis leans 16° in the picture plane, north pole to the right, the way a desk globe does. */
export const GLOBE_ROLL_DEG = -16;
/**
 * The composed still, and where the rotation starts: Europe and Africa face the reader, the
 * Americas' east coast and the Gulf sit inside either limb. Chosen in 2026-09 for the four-city
 * map and kept because it is still the angle with the most cities on the near side.
 */
export const GLOBE_STILL_LON = 22;
/** One revolution — about 10°/s. Calm enough to sit beside copy, quick enough to read as turning. */
export const GLOBE_REVOLUTION_S = 36;
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

/**
 * The markers — seventeen of the most recognisable hubs, WGS84 degrees. 2026-10-06 the client asked
 * for dots on major cities and the pulsing stronger; the same day, seeing it: *"too many dots …
 * you have added many locations; remove some of them and make the whole globe look more
 * professional, sleek."* So this is a spread, not a census: no two markers closer than ~12° of
 * arc (the test pins it), one or two per region, nothing clustered (no Paris beside London, no
 * Shanghai beside Tokyo). Decorative, so the names are for whoever edits this list and are never
 * rendered.
 */
export const GLOBE_CITIES: readonly (readonly [name: string, lat: number, lon: number])[] = [
  // North America
  ["New York", 40.7128, -74.006],
  ["San Francisco", 37.7749, -122.4194],
  ["Mexico City", 19.4326, -99.1332],
  // South America
  ["Bogotá", 4.711, -74.0721],
  ["São Paulo", -23.5505, -46.6333],
  // Europe
  ["London", 51.5074, -0.1278],
  ["Moscow", 55.7558, 37.6173],
  // Africa
  ["Lagos", 6.5244, 3.3792],
  ["Cairo", 30.0444, 31.2357],
  ["Nairobi", -1.2921, 36.8219],
  ["Johannesburg", -26.2041, 28.0473],
  // The Middle East and Asia
  ["Dubai", 25.2048, 55.2708],
  ["Mumbai", 19.076, 72.8777],
  ["Singapore", 1.3521, 103.8198],
  ["Hong Kong", 22.3193, 114.1694],
  ["Tokyo", 35.6762, 139.6503],
  // Oceania
  ["Sydney", -33.8688, 151.2093],
];

/** A marker's radius, in sphere radii, and the floor in CSS px that keeps it a dot on a phone. */
export const GLOBE_MARKER = 0.0105;
export const GLOBE_MARKER_MIN_PX = 2;

/**
 * The signal, restored 2026-10-06 after the client saw the arc-less version: *"It should be visible
 * that one dot is going to another dot … Add that connecting pattern back."* Calm is kept by what
 * stays out (no halo, no ring per dot on its own phase) rather than by removing the connection.
 *
 * Every `GLOBE_ARC_SLOT_S` a slot opens and one update leaves a near-side city for another at
 * least `GLOBE_ARC_MIN_DEG` away: a short comet runs the great-circle arc in `GLOBE_ARC_S`, a faint
 * trace of the path lingers `GLOBE_ARC_TRACE_S` after it, and when the comet lands the destination
 * answers with ONE hairline ring (`GLOBE_PULSE_REACH_PX` over `GLOBE_PULSE_LIFE_S`). At most
 * `GLOBE_ARC_MAX` arcs exist at once, trace included. Which pair is `pickArcPair(slot, …)`, a pure
 * function of the slot and what is visible, so every load plays the same sequence: no randomness.
 */
export const GLOBE_ARC_SLOT_S = 1.2;
export const GLOBE_ARC_S = 1.7;
export const GLOBE_ARC_TRACE_S = 1;
export const GLOBE_ARC_MAX = 3;
export const GLOBE_ARC_MIN_DEG = 35;
export const GLOBE_ARC_MAX_DEG = 100;
/** A city this far onto the near side may send or receive. */
export const GLOBE_ARC_SEEN = 0.5;
export const GLOBE_PULSE_LIFE_S = 1.8;
export const GLOBE_PULSE_REACH_PX = 12;

/** A number in [0, 1) that depends only on `slot` — the choice of which near-side city sends. */
export function pulsePick(slot: number): number {
  return seededRandom(0x5bd1e995 ^ Math.imul(slot + 1, 0x9e3779b1))();
}

let cityVecs: [number, number, number][] | null = null;
/** The angle between two cities, in degrees. */
export function cityAngleDeg(i: number, j: number): number {
  cityVecs ??= GLOBE_CITIES.map(([, la, lo]) => latLonVector(la, lo));
  const a = cityVecs[i]!, b = cityVecs[j]!;
  return (Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;
}

/**
 * The pair for `slot`: a source among the `visible` city indices, a destination among the others
 * between `GLOBE_ARC_MIN_DEG` and `GLOBE_ARC_MAX_DEG` away, never the previous pair (either way
 * round). Pure — the same slot and the same visible set always give the same pair. `null` when
 * nothing qualifies.
 */
export function pickArcPair(
  slot: number,
  visible: readonly number[],
  prev: readonly [number, number] | null,
): [number, number] | null {
  const len = visible.length;
  if (len < 2) return null;
  const start = Math.floor(pulsePick(slot) * len);
  for (let k = 0; k < len; k++) {
    const from = visible[(start + k) % len]!;
    const dests = visible.filter((to) => {
      if (to === from) return false;
      const deg = cityAngleDeg(from, to);
      if (deg < GLOBE_ARC_MIN_DEG || deg > GLOBE_ARC_MAX_DEG) return false;
      return !(prev && ((prev[0] === from && prev[1] === to) || (prev[0] === to && prev[1] === from)));
    });
    if (dests.length) return [from, dests[Math.floor(pulsePick(slot + 100003) * dests.length)]!];
  }
  return null;
}

/**
 * How visible a marker is at depth `z` — nothing behind the limb, all of it a little way in. A
 * back-side marker (`z ≤ 0`) is always 0, so it can never show through the sphere.
 */
export function markerSeen(z: number): number {
  return smoothstep(0.02, 0.18, z);
}

/**
 * A seeded generator (mulberry32): deterministic from its seed, so the globe never calls
 * `Math.random` and a given load always plays the same sequence.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

/**
 * The still's markers: every city on the near side, in `STILL_UNIT`s, with the depth fade the
 * canvas applies. A city behind the limb is left out entirely rather than drawn at zero.
 */
export function stillMarkers(m: Mat3): { x: number; y: number; seen: number }[] {
  const out: { x: number; y: number; seen: number }[] = [];
  for (const [, lat, lon] of GLOBE_CITIES) {
    const p = project(m, latLonVector(lat, lon));
    const seen = markerSeen(p.z);
    if (seen <= 0) continue;
    out.push({ x: Math.round(p.x * STILL_UNIT), y: Math.round(p.y * STILL_UNIT), seen });
  }
  return out;
}

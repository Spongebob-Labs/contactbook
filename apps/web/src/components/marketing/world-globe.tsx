"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { MayaCity } from "@/fixtures/marketing-identity";

import {
  bandOf,
  bandStyle,
  facingCity,
  facingLevel,
  GLOBE_BANDS,
  GLOBE_DOT,
  GLOBE_FRAME,
  GLOBE_GLOW,
  GLOBE_RADIUS,
  GLOBE_REVOLUTION_S,
  GLOBE_STILL_LON,
  labelShift,
  landVectors,
  latLonVector,
  type Mat3,
  project,
  smoothstep,
  STILL_UNIT,
  stillBands,
  viewMatrix,
  wrapDeg,
} from "./globe-geometry";

/**
 * The four-cities globe — the client island inside `world-map.tsx`'s band.
 *
 * 2026-09-29: Vansh asked for the flat map to become a globe that turns on its own and lights
 * each city as it comes round. What it is, and the contract it keeps:
 *
 * · **First paint is a still, not a blank.** This component server-renders the composed still
 *   as SVG (the land as eight round-capped paths, `globe-geometry.ts`) with the four pins in
 *   HTML. No script, a failed canvas, or `prefers-reduced-motion` all leave a finished picture.
 * · **The canvas takes over imperatively.** One rAF loop rotates ~4,700 precomputed unit vectors
 *   by one matrix, fills eight depth bands, and writes transform/opacity on four pins. Nothing
 *   re-renders per frame and nothing reads layout in the loop; the device-pixel ratio is capped
 *   at 2. Colours are the `--mk-*` tokens, read off the element and re-read on a skin switch.
 * · **WCAG 2.2.2.** It moves for longer than five seconds beside copy, so it carries a visible
 *   Pause/Play button; it only runs while the band is on screen and the tab is visible, and it
 *   starts only once the band scrolls into view. Under reduced motion it never turns: one still,
 *   all four cities named, no highlight.
 * · **Decorative.** The stage is `aria-hidden`; the list beside it is the content. Its
 *   highlight is a CSS hairline driven by `data-active` — no focus moves, nothing is announced.
 */

export interface WorldGlobeControl {
  /** The button's visible word while the globe turns. */
  pause: string;
  /** The button's visible word while it is paused. */
  play: string;
  /** Appended for assistive tech only, so the name says what is paused. */
  subject: string;
}

export interface WorldGlobeProps {
  label: string;
  cities: readonly MayaCity[];
  control: WorldGlobeControl;
}

type Vec3 = [number, number, number];

interface StillPin {
  x: number;
  y: number;
  z: number;
}

interface GlobeElements {
  root: HTMLElement;
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  pins: (HTMLElement | null)[];
  names: (HTMLElement | null)[];
  places: (HTMLElement | null)[];
}

interface GlobeController {
  setPaused(paused: boolean): void;
  destroy(): void;
}

const TAU = Math.PI * 2;
/** The Bézier handle length that draws a quarter-ellipse. */
const K = 0.5523;
/** A ring pulse's period and reach, in seconds and CSS px from the pin's centre. */
const RING_S = 2.6;
const RING_FROM = 8;
const RING_TO = 30;
/** The hand-off arc: how long its head takes to travel, and how far its tail trails. */
const ARC_S = 1.5;
const ARC_TRAIL_S = 0.8;
const ARC_STEPS = 48;
/** How quickly a name fades in or out when its city takes or gives up the highlight. */
const NAME_EASE_S = 0.32;

/** A token, resolved by the canvas itself into `[r, g, b]` — whatever syntax the skin used. */
function tokenRgb(probe: CanvasRenderingContext2D, value: string): [number, number, number] {
  probe.fillStyle = value;
  const norm = String(probe.fillStyle);
  if (norm.startsWith("#")) {
    return [1, 3, 5].map((i) => Number.parseInt(norm.slice(i, i + 2), 16)) as [number, number, number];
  }
  const n = norm.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0];
}

/** `[r, g, b]` at an opacity, as the 8-digit hex form a canvas colour stop accepts. */
function withAlpha(rgb: readonly number[], alpha: number): string {
  const hex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${hex(rgb[0]!)}${hex(rgb[1]!)}${hex(rgb[2]!)}${hex(alpha * 255)}`;
}

function slerpLift(a: Vec3, b: Vec3, omega: number, u: number, lift: number): Vec3 {
  const s = Math.sin(omega) || 1;
  const wa = Math.sin((1 - u) * omega) / s;
  const wb = Math.sin(u * omega) / s;
  const h = 1 + lift * Math.sin(Math.PI * u);
  return [(wa * a[0] + wb * b[0]) * h, (wa * a[1] + wb * b[1]) * h, (wa * a[2] + wb * b[2]) * h];
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function startGlobe(
  els: GlobeElements,
  cities: readonly MayaCity[],
  still: readonly StillPin[],
): GlobeController | null {
  const ctx = els.canvas.getContext("2d");
  if (!ctx) return null;
  const base = document.createElement("canvas");
  const baseCtx = base.getContext("2d");
  if (!baseCtx) return null;

  const dots = landVectors();
  const count = dots.length / 3;
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const pz = new Float32Array(count);
  const band = new Uint8Array(count);
  const vecs = cities.map((c) => latLonVector(c.lat, c.lon));
  const level = cities.map(() => 0);

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motionQuery.matches;
  let paused = false;
  let onScreen = false;
  let hidden = document.hidden;

  let lon = GLOBE_STILL_LON;
  let clock = 0;
  let last = 0;
  let raf = 0;
  let active = -1;
  let activeSince = 0;
  let arc: { a: Vec3; b: Vec3; omega: number; lift: number; t0: number } | null = null;

  let w = 0, h = 0, dpr = 1, R = 0, cx = 0, cy = 0;
  let tint: [number, number, number] = [0, 0, 0];
  let display: [number, number, number] = [0, 0, 0];

  function readTokens() {
    const cs = getComputedStyle(els.stage);
    const tok = (name: string) => cs.getPropertyValue(name).trim();
    tint = tokenRgb(baseCtx!, tok("--mk-accent-tint"));
    display = tokenRgb(baseCtx!, tok("--mk-accent-display"));
    const white = tokenRgb(baseCtx!, tok("--mk-white"));
    const wash = tokenRgb(baseCtx!, tok("--mk-wash"));
    paintBase(white, wash);
  }

  /** The parts that never turn — atmosphere, body, rim — painted once per size or skin. */
  function paintBase(white: readonly number[], wash: readonly number[]) {
    base.width = Math.max(1, Math.round(w * dpr));
    base.height = Math.max(1, Math.round(h * dpr));
    const b = baseCtx!;
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.clearRect(0, 0, w, h);
    if (R <= 0) return;

    const glow = b.createRadialGradient(cx, cy, R, cx, cy, R * (1 + GLOBE_GLOW));
    glow.addColorStop(0, withAlpha(tint, 0.16));
    glow.addColorStop(1, withAlpha(tint, 0));
    b.fillStyle = glow;
    b.beginPath();
    b.arc(cx, cy, R * (1 + GLOBE_GLOW), 0, TAU);
    b.arc(cx, cy, R, 0, TAU, true);
    b.fill();

    // Lit from the upper left and darkening toward the limb: the body that gives the dots a sphere.
    const body = b.createRadialGradient(cx - R * 0.32, cy - R * 0.38, R * 0.05, cx, cy, R);
    body.addColorStop(0, withAlpha(white, 0.7));
    body.addColorStop(0.62, withAlpha(wash, 0.385));
    body.addColorStop(1, withAlpha(wash, 0.7));
    b.fillStyle = body;
    b.beginPath();
    b.arc(cx, cy, R, 0, TAU);
    b.fill();

    b.strokeStyle = withAlpha(tint, 0.5);
    b.lineWidth = 1;
    b.beginPath();
    b.arc(cx, cy, R - 0.5, 0, TAU);
    b.stroke();
  }

  function measure() {
    w = els.stage.clientWidth;
    h = els.stage.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    R = GLOBE_RADIUS * h;
    cx = w / 2;
    cy = h / 2;
    els.canvas.width = Math.max(1, Math.round(w * dpr));
    els.canvas.height = Math.max(1, Math.round(h * dpr));
    readTokens();
  }

  function setActive(next: number) {
    if (next === active) return;
    const prev = active;
    active = next;
    activeSince = clock;
    els.places.forEach((place, i) => place?.toggleAttribute("data-active", i === next));
    arc = null;
    if (prev >= 0 && next >= 0) {
      const a = vecs[prev]!, b = vecs[next]!;
      const omega = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      arc = { a, b, omega, lift: 0.06 + 0.14 * (omega / Math.PI), t0: clock };
    }
  }

  function drawDots(m: Mat3) {
    let n = 0;
    for (let i = 0; i < count; i++) {
      const x = dots[i * 3]!, y = dots[i * 3 + 1]!, z = dots[i * 3 + 2]!;
      const vz = m[6] * x + m[7] * y + m[8] * z;
      if (vz <= 0.02) continue;
      px[n] = m[0] * x + m[1] * y + m[2] * z;
      py[n] = m[3] * x + m[4] * y + m[5] * z;
      pz[n] = vz;
      band[n] = bandOf(vz);
      n++;
    }
    const r0 = GLOBE_DOT * R;
    ctx!.fillStyle = withAlpha(tint, 1);
    for (let k = 0; k < GLOBE_BANDS; k++) {
      ctx!.globalAlpha = bandStyle(k).alpha;
      ctx!.beginPath();
      for (let i = 0; i < n; i++) {
        if (band[i] !== k) continue;
        const z = pz[i]!;
        const r = r0 * (0.55 + 0.45 * Math.sqrt(z));
        const X = cx + px[i]! * R, Y = cy + py[i]! * R;
        if (z > 0.81) {
          ctx!.moveTo(X + r, Y);
          ctx!.arc(X, Y, r, 0, TAU);
        } else {
          // Foreshortened: flattened along the radius, the way a disc on a turning sphere reads.
          // Four Béziers by hand, not `ellipse()` — which measured 5× slower at 4× CPU throttle
          // (10.5ms a frame against 2.0ms) for the same shape.
          const len = Math.hypot(px[i]!, py[i]!) || 1;
          const ux = px[i]! / len, uy = py[i]! / len;
          const ax = ux * r * Math.max(z, 0.35), ay = uy * r * Math.max(z, 0.35);
          const bx = -uy * r, by = ux * r;
          const c = ctx!;
          c.moveTo(X + ax, Y + ay);
          c.bezierCurveTo(X + ax + K * bx, Y + ay + K * by, X + bx + K * ax, Y + by + K * ay, X + bx, Y + by);
          c.bezierCurveTo(X + bx - K * ax, Y + by - K * ay, X - ax + K * bx, Y - ay + K * by, X - ax, Y - ay);
          c.bezierCurveTo(X - ax - K * bx, Y - ay - K * by, X - bx - K * ax, Y - by - K * ay, X - bx, Y - by);
          c.bezierCurveTo(X - bx + K * ax, Y - by + K * ay, X + ax - K * bx, Y + ay - K * by, X + ax, Y + ay);
        }
      }
      ctx!.fill();
    }
    ctx!.globalAlpha = 1;
  }

  function drawArc(m: Mat3) {
    if (!arc) return;
    const t = clock - arc.t0;
    const head = easeInOut(Math.min(1, t / ARC_S));
    const tail = easeInOut(Math.min(1, Math.max(0, (t - ARC_TRAIL_S) / ARC_S)));
    if (tail >= 1) {
      arc = null;
      return;
    }
    ctx!.beginPath();
    let pen = false;
    let fromX = 0, fromY = 0, toX = 0, toY = 0;
    for (let s = 0; s <= ARC_STEPS; s++) {
      const u = tail + ((head - tail) * s) / ARC_STEPS;
      const p = project(m, slerpLift(arc.a, arc.b, arc.omega, u, arc.lift));
      const X = cx + p.x * R, Y = cy + p.y * R;
      if (s === 0) [fromX, fromY] = [X, Y];
      [toX, toY] = [X, Y];
      // Behind the sphere, and inside its disc: hidden.
      if (p.z < 0 && p.x * p.x + p.y * p.y < 1) {
        pen = false;
        continue;
      }
      if (pen) ctx!.lineTo(X, Y);
      else ctx!.moveTo(X, Y);
      pen = true;
    }
    // A comet, not a stroke: clear at the tail, full at the head.
    const trail = ctx!.createLinearGradient(fromX, fromY, toX, toY);
    trail.addColorStop(0, withAlpha(display, 0));
    trail.addColorStop(1, withAlpha(display, 0.85));
    ctx!.strokeStyle = trail;
    ctx!.lineWidth = 1.25;
    ctx!.lineCap = "round";
    ctx!.stroke();
  }

  function draw(dt: number) {
    const m = viewMatrix(lon);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, w, h);
    ctx!.drawImage(base, 0, 0, w, h);
    drawDots(m);
    if (!reduced) drawArc(m);

    const ps = vecs.map((v) => project(m, v));
    setActive(reduced ? -1 : facingCity(cities, ps.map((p) => p.z), lon, active));
    const ease = dt > 0 ? 1 - Math.exp(-dt / NAME_EASE_S) : 1;
    cities.forEach((_, i) => {
      const p = ps[i]!;
      // Pins fade only in the last few degrees before the limb, so the still's two limb cities
      // (z ≈ 0.13) read as fully on the near side, as the server-rendered still draws them.
      const seen = smoothstep(0, 0.1, p.z);
      const s = still[i]!;
      const pin = els.pins[i];
      if (pin) {
        // The loop owns visibility too: a pin the still rendered on the far side must come back.
        pin.style.visibility = seen > 0 ? "visible" : "hidden";
        pin.style.opacity = String(seen);
        pin.style.transform = `translate3d(${((p.x - s.x) * R).toFixed(2)}px, ${((p.y - s.y) * R).toFixed(2)}px, 0)`;
      }
      const target = reduced ? 1 : i === active ? facingLevel(p.z) : 0;
      level[i]! += (target - level[i]!) * ease;
      const name = els.names[i];
      if (name) {
        name.style.opacity = String(level[i]! * seen);
        name.style.transform = `translateX(${labelShift(p.x).toFixed(1)}%)`;
      }
      if (!reduced && i === active && level[i]! > 0.01) {
        const X = cx + p.x * R, Y = cy + p.y * R;
        ctx!.strokeStyle = withAlpha(display, 1);
        ctx!.lineWidth = 1.25;
        for (const offset of [0, 0.5]) {
          const phase = (((clock - activeSince) / RING_S + offset) % 1 + 1) % 1;
          ctx!.globalAlpha = 0.55 * Math.pow(1 - phase, 1.6) * level[i]! * seen;
          ctx!.beginPath();
          ctx!.arc(X, Y, RING_FROM + (RING_TO - RING_FROM) * easeOut(phase), 0, TAU);
          ctx!.stroke();
        }
        ctx!.globalAlpha = 1;
      }
    });
  }

  const running = () => !reduced && !paused && onScreen && !hidden;

  function frame(now: number) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    clock += dt;
    lon = wrapDeg(lon - (dt * 360) / GLOBE_REVOLUTION_S);
    draw(dt);
    if (running()) raf = requestAnimationFrame(frame);
  }

  function sync() {
    els.root.toggleAttribute("data-globe-motion", !reduced);
    if (running()) {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function redraw() {
    draw(0);
  }

  function onMotionChange() {
    reduced = motionQuery.matches;
    if (reduced) {
      lon = GLOBE_STILL_LON;
      arc = null;
    }
    redraw();
    sync();
  }

  function onVisibility() {
    hidden = document.hidden;
    sync();
  }

  measure();
  // The first frame lands before the still is hidden, so the hand-over is never a blank frame.
  redraw();
  els.stage.setAttribute("data-globe", "live");
  sync();

  const io =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((entries) => {
          onScreen = entries.some((e) => e.isIntersecting);
          sync();
        });
  io?.observe(els.stage);

  const ro =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          measure();
          redraw();
        });
  ro?.observe(els.stage);

  const skinRoot = els.root.closest("[data-mk-root]");
  const mo =
    skinRoot && typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => {
          readTokens();
          redraw();
        })
      : null;
  if (skinRoot) mo?.observe(skinRoot, { attributes: true, attributeFilter: ["data-mk-skin"] });

  motionQuery.addEventListener("change", onMotionChange);
  document.addEventListener("visibilitychange", onVisibility);

  return {
    setPaused(next) {
      paused = next;
      sync();
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
      ro?.disconnect();
      mo?.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibility);
      els.stage.removeAttribute("data-globe");
      els.root.removeAttribute("data-globe-motion");
      els.places.forEach((place) => place?.removeAttribute("data-active"));
    },
  };
}

/** A pin's place in the still's square box, as a percentage of that box. */
const framePct = (v: number) => `${(((GLOBE_FRAME + v) / (2 * GLOBE_FRAME)) * 100).toFixed(3)}%`;

export function WorldGlobe({ label, cities, control }: WorldGlobeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pinRefs = useRef<(HTMLElement | null)[]>([]);
  const nameRefs = useRef<(HTMLElement | null)[]>([]);
  const placeRefs = useRef<(HTMLElement | null)[]>([]);
  const engineRef = useRef<GlobeController | null>(null);
  const [paused, setPaused] = useState(false);
  const uid = useId().replace(/:/g, "");

  const still = useMemo(() => {
    const m = viewMatrix(GLOBE_STILL_LON);
    return {
      bands: stillBands(m),
      pins: cities.map((c) => project(m, latLonVector(c.lat, c.lon))),
    };
  }, [cities]);

  useEffect(() => {
    const root = rootRef.current, stage = stageRef.current, canvas = canvasRef.current;
    if (!root || !stage || !canvas) return;
    const engine = startGlobe(
      { root, stage, canvas, pins: pinRefs.current, names: nameRefs.current, places: placeRefs.current },
      cities,
      still.pins,
    );
    engineRef.current = engine;
    return () => {
      engine?.destroy();
      engineRef.current = null;
    };
  }, [cities, still]);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  const U = STILL_UNIT;
  const box = GLOBE_FRAME * U;
  const glowStop = 1 / (1 + GLOBE_GLOW);

  return (
    <div ref={rootRef} className="mk-globe">
      <p className="mk-map__label">{label}</p>

      <button type="button" className="mk-globe__pause" onClick={() => setPaused((p) => !p)}>
        <span aria-hidden="true" className="mk-globe__pause-icon">
          {paused ? <Play size={12} strokeWidth={2.25} /> : <Pause size={12} strokeWidth={2.25} />}
        </span>
        {paused ? control.play : control.pause}
        <span className="sr-only"> {control.subject}</span>
      </button>

      <div className="mk-map__body">
        <div ref={stageRef} className="mk-globe__stage" data-globe="still" aria-hidden="true">
          <canvas ref={canvasRef} className="mk-globe__canvas" aria-hidden="true" />

          <div className="mk-globe__frame" style={{ height: `${2 * GLOBE_FRAME * GLOBE_RADIUS * 100}%` }}>
            <svg viewBox={`${-box} ${-box} ${2 * box} ${2 * box}`} className="mk-globe__still" focusable="false">
              <defs>
                <radialGradient id={`${uid}-glow`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={U * (1 + GLOBE_GLOW)}>
                  {/* Two stops at the limb make a hard edge: the atmosphere is outside the disc only. */}
                  <stop offset={glowStop} className="mk-globe__stop-tint" stopOpacity="0" />
                  <stop offset={glowStop} className="mk-globe__stop-tint" stopOpacity="0.16" />
                  <stop offset="1" className="mk-globe__stop-tint" stopOpacity="0" />
                </radialGradient>
                <radialGradient
                  id={`${uid}-body`}
                  gradientUnits="userSpaceOnUse"
                  fx={-0.32 * U}
                  fy={-0.38 * U}
                  fr={0.05 * U}
                  cx="0"
                  cy="0"
                  r={U}
                >
                  <stop offset="0" className="mk-globe__stop-lit" stopOpacity="0.7" />
                  <stop offset="0.62" className="mk-globe__stop-wash" stopOpacity="0.385" />
                  <stop offset="1" className="mk-globe__stop-wash" stopOpacity="0.7" />
                </radialGradient>
              </defs>
              <circle r={U * (1 + GLOBE_GLOW)} fill={`url(#${uid}-glow)`} />
              <circle r={U} fill={`url(#${uid}-body)`} />
              <circle r={U - 1.5} className="mk-globe__rim" />
              {still.bands.map((b, k) =>
                b.d ? (
                  <path
                    key={k}
                    d={b.d}
                    className="mk-globe__land"
                    strokeWidth={b.width.toFixed(1)}
                    strokeOpacity={b.alpha.toFixed(3)}
                  />
                ) : null,
              )}
            </svg>

            {cities.map((city, i) => {
              const p = still.pins[i]!;
              return (
                <span
                  key={city.id}
                  ref={(el) => {
                    pinRefs.current[i] = el;
                  }}
                  data-city={city.id}
                  className="mk-map__pin"
                  style={{
                    left: framePct(p.x),
                    top: framePct(p.y),
                    visibility: p.z > 0 ? undefined : "hidden",
                    ["--mk-map-i" as string]: i,
                  }}
                >
                  <span className="mk-map__halo" />
                  <span className="mk-map__dot" />
                  <span
                    ref={(el) => {
                      nameRefs.current[i] = el;
                    }}
                    className="mk-globe__name"
                    style={{ transform: `translateX(${labelShift(p.x).toFixed(1)}%)` }}
                  >
                    {city.city}
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        <ul className="mk-map__legend" role="list">
          {cities.map((city, i) => (
            <li
              key={city.id}
              ref={(el) => {
                placeRefs.current[i] = el;
              }}
              data-city={city.id}
              className="mk-map__place"
            >
              <p className="mk-map__city">{city.city}</p>
              <p className="mk-map__phone">{city.phone}</p>
              <p className="mk-map__address">{city.address}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

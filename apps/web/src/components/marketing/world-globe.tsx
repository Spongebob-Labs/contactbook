"use client";

import { Pause, Play } from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  bandOf,
  bandStyle,
  GLOBE_BANDS,
  GLOBE_CITIES,
  GLOBE_DOT,
  GLOBE_FRAME,
  GLOBE_GLOW,
  GLOBE_MARKER,
  GLOBE_MARKER_MIN_PX,
  GLOBE_ARC_MAX,
  GLOBE_ARC_S,
  GLOBE_ARC_SEEN,
  GLOBE_ARC_SLOT_S,
  GLOBE_ARC_TRACE_S,
  GLOBE_PULSE_LIFE_S,
  GLOBE_PULSE_REACH_PX,
  GLOBE_RADIUS,
  GLOBE_REVOLUTION_S,
  GLOBE_STILL_LON,
  landVectors,
  latLonVector,
  type Mat3,
  markerSeen,
  pickArcPair,
  smoothstep,
  STILL_UNIT,
  stillBands,
  stillMarkers,
  viewMatrix,
  wrapDeg,
} from "./globe-geometry";

/**
 * The globe — the client island inside `world-map.tsx`'s band.
 *
 * 2026-09-29: Vansh asked for the flat map to become a globe that turns on its own. 2026-10-06:
 * the client kept the globe, dropped the four-city list beside it, and asked for *"dots on all
 * major cities globally … the pulsing more pronounced so that it looks like updates being sent
 * around the globe."* What it is now, and the contract it keeps:
 *
 * · **First paint is a still, not a blank.** This component server-renders the composed still
 *   as SVG (the land as eight round-capped paths, the markers as circles, `globe-geometry.ts`).
 *   No script, a failed canvas, or `prefers-reduced-motion` all leave a finished picture.
 * · **The canvas takes over imperatively.** One rAF loop rotates ~4,700 precomputed land vectors
 *   and seventeen city vectors by one matrix, fills eight depth bands, then draws the signal and
 *   the markers. Nothing re-renders per frame and nothing reads layout in the loop; the
 *   device-pixel ratio is capped at 2. Colours are the `--mk-*` tokens, read off the element and
 *   re-read on a skin switch.
 * · **The signal.** An update travelling from one city to another is the point of the globe (the
 *   client: "it should be visible that one dot is going to another dot"), so it is drawn: every
 *   `GLOBE_ARC_SLOT_S` a near-side pair (`pickArcPair`, pure in the slot) is joined by a great-circle
 *   arc that rises off the surface and lands. A short comet runs it, a faint trace of its path
 *   lingers a second, and on landing the destination sends ONE 1px ring. Two or three arcs at
 *   once, each thin; the restraint the client asked for lives in what is absent: no halo or blur
 *   around any dot, no wave off every city on its own phase, no gradients or shadows per frame.
 *   Markers, arcs and rings fade with depth and anything past the limb is skipped, so the far
 *   side never shows through.
 * · **WCAG 2.2.2.** It moves for longer than five seconds beside copy, so it carries a visible
 *   Pause/Play button; it only runs while the band is on screen and the tab is visible, and it
 *   starts only once the band scrolls into view. Under reduced motion it never turns and never
 *   pulses: one still, static dots.
 * · **Decorative.** The stage is `aria-hidden`; the statement beside it (`children`) is the
 *   content. Nothing is announced.
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
  control: WorldGlobeControl;
  /** What sits beside the globe — server-rendered by the band and passed through. */
  children?: ReactNode;
}

type Vec3 = [number, number, number];

interface GlobeElements {
  root: HTMLElement;
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
}

interface GlobeController {
  setPaused(paused: boolean): void;
  destroy(): void;
}

const TAU = Math.PI * 2;
/** The Bézier handle length that draws a quarter-ellipse. */
const K = 0.5523;
/** The answering ring: hairline, and no stronger than this at its first frame. */
const RING_WIDTH = 1;
const RING_PEAK = 0.7;
/** An arc: 1.1px strokes; the trace at most this opaque, the comet's head at most that. */
const ARC_WIDTH = 1.25;
const TRACE_PEAK = 0.4;
const COMET_PEAK = 0.95;
/** The comet is this share of the arc long, drawn as `COMET_PARTS` strokes brightening to the head. */
const COMET_SHARE = 0.2;
const COMET_PARTS = 3;
const TRACE_STEPS = 24;
const PART_STEPS = 5;

interface Arc {
  a: Vec3;
  b: Vec3;
  omega: number;
  lift: number;
  t0: number;
  from: number;
  to: number;
}

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

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function startGlobe(els: GlobeElements): GlobeController | null {
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

  const n = GLOBE_CITIES.length;
  const cities: Vec3[] = GLOBE_CITIES.map(([, lat, lon]) => latLonVector(lat, lon));
  const cX = new Float32Array(n);
  const cY = new Float32Array(n);
  const cSeen = new Float32Array(n);
  const visible: number[] = [];
  /** Arcs in the air or still showing their trace, and the rings answering their landings. */
  let arcs: Arc[] = [];
  let rings: { city: number; t0: number }[] = [];
  let lastPair: [number, number] | null = null;
  let lastSlot = -1;
  /** The arc being stroked: one scratch buffer, so a frame allocates nothing per point. */
  const pts = new Float32Array((TRACE_STEPS + 1) * 3);

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motionQuery.matches;
  let paused = false;
  let onScreen = false;
  let hidden = document.hidden;

  let lon = GLOBE_STILL_LON;
  let clock = 0;
  let last = 0;
  let raf = 0;

  let w = 0, h = 0, dpr = 1, R = 0, cx = 0, cy = 0;
  let tint: [number, number, number] = [0, 0, 0];
  let ringInk = "";
  let deep = "";
  let white = "";

  function readTokens() {
    const cs = getComputedStyle(els.stage);
    const tok = (name: string) => cs.getPropertyValue(name).trim();
    tint = tokenRgb(baseCtx!, tok("--mk-accent-tint"));
    ringInk = withAlpha(tokenRgb(baseCtx!, tok("--mk-accent-display")), 1);
    const whiteRgb = tokenRgb(baseCtx!, tok("--mk-white"));
    const wash = tokenRgb(baseCtx!, tok("--mk-wash"));
    deep = withAlpha(tokenRgb(baseCtx!, tok("--mk-accent-deep")), 1);
    white = withAlpha(whiteRgb, 1);
    paintBase(whiteRgb, wash);
  }

  /** The parts that never turn — atmosphere, body, rim — painted once per size or skin. */
  function paintBase(whiteRgb: readonly number[], wash: readonly number[]) {
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
    body.addColorStop(0, withAlpha(whiteRgb, 0.7));
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

  function drawDots(m: Mat3) {
    let k0 = 0;
    for (let i = 0; i < count; i++) {
      const x = dots[i * 3]!, y = dots[i * 3 + 1]!, z = dots[i * 3 + 2]!;
      const vz = m[6] * x + m[7] * y + m[8] * z;
      if (vz <= 0.02) continue;
      px[k0] = m[0] * x + m[1] * y + m[2] * z;
      py[k0] = m[3] * x + m[4] * y + m[5] * z;
      pz[k0] = vz;
      band[k0] = bandOf(vz);
      k0++;
    }
    const r0 = GLOBE_DOT * R;
    ctx!.fillStyle = withAlpha(tint, 1);
    for (let k = 0; k < GLOBE_BANDS; k++) {
      ctx!.globalAlpha = bandStyle(k).alpha;
      ctx!.beginPath();
      for (let i = 0; i < k0; i++) {
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

  /** Every city's screen position and depth fade for this frame — the one projection per city. */
  function placeCities(m: Mat3) {
    for (let i = 0; i < n; i++) {
      const v = cities[i]!;
      cX[i] = cx + (m[0] * v[0] + m[1] * v[1] + m[2] * v[2]) * R;
      cY[i] = cy + (m[3] * v[0] + m[4] * v[1] + m[5] * v[2]) * R;
      cSeen[i] = markerSeen(m[6] * v[0] + m[7] * v[1] + m[8] * v[2]);
    }
  }

  /** At each new slot, one near-side pair (`pickArcPair`) gets an arc, if fewer than the max exist. */
  function schedule() {
    const slot = Math.floor(clock / GLOBE_ARC_SLOT_S);
    if (slot === lastSlot) return;
    lastSlot = slot;
    if (arcs.length >= GLOBE_ARC_MAX) return;
    visible.length = 0;
    for (let i = 0; i < n; i++) if (cSeen[i]! >= GLOBE_ARC_SEEN) visible.push(i);
    const pair = pickArcPair(slot, visible, lastPair);
    if (!pair) return;
    lastPair = pair;
    const a = cities[pair[0]]!, b = cities[pair[1]]!;
    const omega = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    arcs.push({ a, b, omega, lift: 0.09 + 0.16 * (omega / Math.PI), t0: clock, from: pair[0], to: pair[1] });
  }

  /**
   * Strokes the arc between path fractions `u0` and `u1` in one path, at `alpha`. The great circle
   * is slerped and lifted off the surface, projected by the frame's matrix, and drawn only where it
   * is on the near side (or outside the disc, where it rises past the limb). Depth fades it.
   */
  function strokeArc(arc: Arc, m: Mat3, u0: number, u1: number, steps: number, alpha: number) {
    const c = ctx!;
    const sw = Math.sin(arc.omega) || 1;
    let zSum = 0;
    for (let s = 0; s <= steps; s++) {
      const u = u0 + ((u1 - u0) * s) / steps;
      const wa = Math.sin((1 - u) * arc.omega) / sw, wb = Math.sin(u * arc.omega) / sw;
      const hgt = 1 + arc.lift * Math.sin(Math.PI * u);
      const x = (wa * arc.a[0] + wb * arc.b[0]) * hgt;
      const y = (wa * arc.a[1] + wb * arc.b[1]) * hgt;
      const z = (wa * arc.a[2] + wb * arc.b[2]) * hgt;
      const sx = m[0] * x + m[1] * y + m[2] * z, sy = m[3] * x + m[4] * y + m[5] * z, sz = m[6] * x + m[7] * y + m[8] * z;
      pts[s * 3] = cx + sx * R;
      pts[s * 3 + 1] = cy + sy * R;
      pts[s * 3 + 2] = sx * sx + sy * sy < 1 ? sz : 1;
      zSum += pts[s * 3 + 2]!;
    }
    const fade = smoothstep(0.02, 0.3, zSum / (steps + 1));
    if (fade <= 0) return;
    c.globalAlpha = alpha * fade;
    c.beginPath();
    let pen = false;
    for (let s = 0; s <= steps; s++) {
      if (pts[s * 3 + 2]! <= 0.02) {
        pen = false;
        continue;
      }
      if (pen) c.lineTo(pts[s * 3]!, pts[s * 3 + 1]!);
      else c.moveTo(pts[s * 3]!, pts[s * 3 + 1]!);
      pen = true;
    }
    c.stroke();
  }

  function drawArcs(m: Mat3) {
    if (!arcs.length) return;
    const c = ctx!;
    c.lineWidth = ARC_WIDTH;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = deep;
    for (const arc of arcs) {
      const t = clock - arc.t0;
      const head = easeInOut(Math.min(1, t / GLOBE_ARC_S));
      if (t >= GLOBE_ARC_S && !rings.some((r) => r.t0 === arc.t0 + GLOBE_ARC_S && r.city === arc.to)) {
        rings.push({ city: arc.to, t0: arc.t0 + GLOBE_ARC_S });
      }
      // The trace: the whole path behind the head, fading out once the head has landed.
      const linger = t < GLOBE_ARC_S ? 1 : 1 - (t - GLOBE_ARC_S) / GLOBE_ARC_TRACE_S;
      if (linger > 0) strokeArc(arc, m, 0, head, TRACE_STEPS, TRACE_PEAK * linger);
      // The comet: a few short strokes, brighter toward the head, gone as it lands.
      if (t < GLOBE_ARC_S) {
        const len = COMET_SHARE * easeOut(Math.min(1, t / 0.35));
        for (let k = 0; k < COMET_PARTS; k++) {
          const u0 = Math.max(0, head - len * (1 - k / COMET_PARTS));
          const u1 = Math.max(0, head - len * (1 - (k + 1) / COMET_PARTS));
          strokeArc(arc, m, u0, u1, PART_STEPS, COMET_PEAK * ((k + 1) / COMET_PARTS));
        }
      }
    }
    c.globalAlpha = 1;
    arcs = arcs.filter((arc) => clock - arc.t0 < GLOBE_ARC_S + GLOBE_ARC_TRACE_S);
  }

  /** The destination's answer: one 1px ring that grows `GLOBE_PULSE_REACH_PX` and fades. */
  function drawRings(rDot: number) {
    if (!rings.length) return;
    const c = ctx!;
    c.strokeStyle = ringInk;
    c.lineWidth = RING_WIDTH;
    for (const ring of rings) {
      const u = (clock - ring.t0) / GLOBE_PULSE_LIFE_S;
      const seen = cSeen[ring.city]!;
      if (u >= 1 || seen <= 0) continue;
      c.globalAlpha = RING_PEAK * (1 - u) * seen;
      c.beginPath();
      c.arc(cX[ring.city]!, cY[ring.city]!, rDot + 1.25 + GLOBE_PULSE_REACH_PX * easeOut(u), 0, TAU);
      c.stroke();
    }
    c.globalAlpha = 1;
    rings = rings.filter((ring) => clock - ring.t0 < GLOBE_PULSE_LIFE_S);
  }

  function drawCities(animate: boolean, m: Mat3) {
    const c = ctx!;
    const rDot = Math.max(GLOBE_MARKER_MIN_PX, GLOBE_MARKER * R);

    if (animate) {
      schedule();
      drawArcs(m);
      drawRings(rDot);
    }

    // The markers over the arcs and rings: a thin white keyline, then a solid dot. Nothing soft around it.
    for (let i = 0; i < n; i++) {
      const seen = cSeen[i]!;
      if (seen <= 0) continue;
      c.globalAlpha = seen;
      c.fillStyle = white;
      c.beginPath();
      c.arc(cX[i]!, cY[i]!, rDot + 1.25, 0, TAU);
      c.fill();
      c.fillStyle = deep;
      c.beginPath();
      c.arc(cX[i]!, cY[i]!, rDot, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function draw() {
    const m = viewMatrix(lon);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, w, h);
    ctx!.drawImage(base, 0, 0, w, h);
    drawDots(m);
    placeCities(m);
    drawCities(!reduced, m);
  }

  const running = () => !reduced && !paused && onScreen && !hidden;

  function frame(now: number) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    clock += dt;
    lon = wrapDeg(lon - (dt * 360) / GLOBE_REVOLUTION_S);
    draw();
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

  function onMotionChange() {
    reduced = motionQuery.matches;
    if (reduced) {
      lon = GLOBE_STILL_LON;
      arcs = [];
      rings = [];
      lastPair = null;
      lastSlot = -1;
    }
    draw();
    sync();
  }

  function onVisibility() {
    hidden = document.hidden;
    sync();
  }

  measure();
  // The first frame lands before the still is hidden, so the hand-over is never a blank frame.
  draw();
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
          draw();
        });
  ro?.observe(els.stage);

  const skinRoot = els.root.closest("[data-mk-root]");
  const mo =
    skinRoot && typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => {
          readTokens();
          draw();
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
    },
  };
}

export function WorldGlobe({ label, control, children }: WorldGlobeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GlobeController | null>(null);
  const [paused, setPaused] = useState(false);
  const uid = useId().replace(/:/g, "");

  const still = useMemo(() => {
    const m = viewMatrix(GLOBE_STILL_LON);
    return { bands: stillBands(m), markers: stillMarkers(m) };
  }, []);

  useEffect(() => {
    const root = rootRef.current, stage = stageRef.current, canvas = canvasRef.current;
    if (!root || !stage || !canvas) return;
    const engine = startGlobe({ root, stage, canvas });
    engineRef.current = engine;
    return () => {
      engine?.destroy();
      engineRef.current = null;
    };
  }, []);

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
              <g className="mk-globe__markers">
                {still.markers.map((p) => (
                  <circle
                    key={`${p.x},${p.y}`}
                    cx={p.x}
                    cy={p.y}
                    r={GLOBE_MARKER * U}
                    opacity={p.seen < 1 ? p.seen.toFixed(3) : undefined}
                  />
                ))}
              </g>
            </svg>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

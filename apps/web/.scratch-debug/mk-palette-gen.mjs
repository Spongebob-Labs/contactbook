/**
 * mk-palette-gen — the generator behind every ratio in `src/styles/marketing.css`.
 *
 * The marketing layer stopped inventing colour: its palette is now the nine card grounds in
 * `src/card/template-palettes.ts`, verbatim. Those hexes are contrast-proven AS CARD GROUNDS
 * (white or near-black ink ON them). Marketing asks a different question of the same hexes —
 * "may this colour carry text ON PAPER?" — and the answer is not inherited, so every level is
 * re-derived here and every number in the stylesheet's comments is this script's output.
 *
 * Two levels per hue, the same split the file already used:
 *   · DISPLAY — fills, rings, bands. WCAG 1.4.11's 3:1.
 *   · INK     — anything carrying body text. 4.5:1.
 *
 * ⚠ The search DIRECTION flips with the tier, and that is the one new idea here.
 * The old marketing hues were light (azure, teal, coral, amber, orchid), so an ink level was
 * found by DARKENING until 4.5:1 held. Five of the nine card grounds are deep, and their
 * literal hex already measures 12-16:1 on paper — legal, and useless, because at that ratio a
 * "sapphire" link and the near-black body copy are the same colour to the eye. For those the
 * binding constraint is not legibility but SEPARATION FROM THE INK, so the search runs the
 * other way: the LIGHTEST instance of the hue that still clears the bar. Same rule as
 * `derive-palette.ts` uses for `inkSoft` ("the largest shift that satisfies the contract").
 *
 * Hue and saturation are held; lightness alone moves. Run: `node .scratch-debug/mk-palette-gen.mjs`
 */

/* ── WCAG 2.x, transcribed (mirrors src/lib/contrast.ts) ─────────────────────────────── */

const hex2rgb = (h) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(s.slice(i, i + 2), 16));
};
const rgb2hex = ([r, g, b]) =>
  "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
const lin = (c) => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const lum = (h) => {
  const [r, g, b] = hex2rgb(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const r2 = (a, b) => Math.round(ratio(a, b) * 100) / 100;

/** Alpha-composite `fg` at `a` over `bg` — what the browser actually paints for `text-x/75`. */
const over = (fg, bg, a) =>
  rgb2hex(hex2rgb(fg).map((c, i) => c * a + hex2rgb(bg)[i] * (1 - a)));

/* ── HSL, so hue and saturation can be held while lightness is searched ──────────────── */

function rgb2hsl(hex) {
  const [r, g, b] = hex2rgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hsl2hex([h, s, l]) {
  if (s === 0) return rgb2hex([l * 255, l * 255, l * 255]);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return rgb2hex([f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]);
}

/**
 * The LIGHTEST instance of `hue`'s hue+saturation that still clears `min` against `ground`.
 * Used for the five deep card grounds, whose literal hex is legal but indistinguishable from
 * the page's near-black ink.
 */
function liftTo(hue, ground, min) {
  const [h, s, l0] = rgb2hsl(hue);
  let best = hsl2hex([h, s, l0]);
  for (let l = l0; l <= 1; l += 0.001) {
    const c = hsl2hex([h, s, l]);
    if (ratio(c, ground) < min) break;
    best = c;
  }
  return best;
}

/** The smallest DARKENING that clears `min` — the original file's derivation, kept for lights. */
function deepenTo(hue, ground, min) {
  const [h, s, l0] = rgb2hsl(hue);
  for (let l = l0; l >= 0; l -= 0.001) {
    const c = hsl2hex([h, s, l]);
    if (ratio(c, ground) >= min) return c;
  }
  return "#000000";
}

/* ── The inputs ──────────────────────────────────────────────────────────────────────── */

/** The nine card grounds, verbatim from `src/card/template-palettes.ts`. */
const CARD = {
  onyx: "#181A1F",
  sapphire: "#142C63",
  emerald: "#0D3C2E",
  oxblood: "#5B1626",
  rust: "#80371C",
  amber: "#E1AA40",
  clay: "#E3A28A",
  pistachio: "#BFD48C",
  periwinkle: "#B4C1EC",
};
/** Amber's own button ink, from the same file. The CTA label. */
const AMBER_BUTTON_INK = "#3A2408";
/** Emerald's two gradient stops, from the same file. The meadow. */
const EMERALD_FROM = "#12513E";
const EMERALD_TO = "#07271E";

const PAPER = "#f5f5f5";
const WHITE = "#ffffff";
const STONE = "#766f65";
const PEBBLE = "#72706f";

const out = [];
const say = (...a) => out.push(a.join(" "));

say("── The nine card grounds, measured on the marketing canvas ─────────────────────");
for (const [k, v] of Object.entries(CARD)) {
  say(
    k.padEnd(11),
    v,
    "on paper",
    String(r2(v, PAPER)).padStart(6),
    " white on it",
    String(r2(WHITE, v)).padStart(6),
    " onyx-ink on it",
    String(r2(CARD.onyx, v)).padStart(6),
  );
}

say("");
say("── Derived levels ──────────────────────────────────────────────────────────────");
const sapphireInk = liftTo(CARD.sapphire, PAPER, 4.5);
const sapphireRing = liftTo(CARD.sapphire, PAPER, 3);
const emeraldInk = liftTo(CARD.emerald, PAPER, 4.5);
const rustInk = liftTo(CARD.rust, PAPER, 4.5);
const oxbloodInk = liftTo(CARD.oxblood, PAPER, 4.5);
const amberInk = deepenTo(CARD.amber, PAPER, 4.5);
say("sapphire-ink ", sapphireInk, "paper", r2(sapphireInk, PAPER), " white", r2(sapphireInk, WHITE));
say("sapphire-ring", sapphireRing, "paper", r2(sapphireRing, PAPER), " on sky-zenith", r2(sapphireRing, CARD.sapphire), " on sky-horizon", r2(sapphireRing, CARD.onyx));
say("emerald-ink  ", emeraldInk, "paper", r2(emeraldInk, PAPER), " white", r2(emeraldInk, WHITE));
say("rust-ink     ", rustInk, "paper", r2(rustInk, PAPER));
say("oxblood-ink  ", oxbloodInk, "paper", r2(oxbloodInk, PAPER));
say("amber-ink    ", amberInk, "paper", r2(amberInk, PAPER));
say("separation: sapphire-ink vs ink", r2(sapphireInk, CARD.onyx), " emerald-ink vs ink", r2(emeraldInk, CARD.onyx));

say("");
say("── The sky (Sapphire → Onyx) and the meadow (Emerald's own stops) ──────────────");
for (const [name, stop] of [
  ["sky-zenith  Sapphire", CARD.sapphire],
  ["sky-horizon Onyx    ", CARD.onyx],
  ["field-near  Em/from ", EMERALD_FROM],
  ["field-far   Em/to   ", EMERALD_TO],
]) {
  say(
    name,
    stop,
    " white",
    String(r2(WHITE, stop)).padStart(6),
    " white@90%",
    String(r2(over(WHITE, stop, 0.9), stop)).padStart(6),
    " white@75%",
    String(r2(over(WHITE, stop, 0.75), stop)).padStart(6),
    " amber fill",
    String(r2(CARD.amber, stop)).padStart(6),
  );
}
/* Sampled down the ramp the browser actually paints, in sRGB — the pessimistic case, since
   `in oklab` stays more saturated and therefore slightly darker under white type. */
say("ramp:");
for (const t of [0, 0.25, 0.5, 0.75, 1]) {
  const c = rgb2hex(
    hex2rgb(CARD.sapphire).map((a, i) => a + (hex2rgb(CARD.onyx)[i] - a) * t),
  );
  say("  y=" + String(t * 100).padStart(3) + "%", c, " white", r2(WHITE, c), " white@75%", r2(over(WHITE, c, 0.75), c));
}

say("");
say("── The primary action: Amber fill, Amber's own button ink ──────────────────────");
say("label on fill      ", AMBER_BUTTON_INK, "on", CARD.amber, "=", r2(AMBER_BUTTON_INK, CARD.amber));
say("fill on paper      ", r2(CARD.amber, PAPER));
say("fill on white      ", r2(CARD.amber, WHITE));
say("fill on ink/onyx   ", r2(CARD.amber, CARD.onyx));
say("fill on sky-zenith ", r2(CARD.amber, CARD.sapphire));
say("fill on field-near ", r2(CARD.amber, EMERALD_FROM));

say("");
say("── The four wash grounds ───────────────────────────────────────────────────────");
for (const k of ["clay", "pistachio", "periwinkle", "amber"]) {
  const g = CARD[k];
  say(
    k.padEnd(11),
    g,
    " ink",
    String(r2(CARD.onyx, g)).padStart(6),
    " stone",
    String(r2(STONE, g)).padStart(6),
    " pebble",
    String(r2(PEBBLE, g)).padStart(6),
    " ink@70%",
    String(r2(over(CARD.onyx, g, 0.7), g)).padStart(6),
  );
}

say("");
say("── Marker rings + the roadmap status, on the Periwinkle wash ───────────────────");
for (const k of ["sapphire", "oxblood", "rust", "emerald"]) {
  say(k.padEnd(11), CARD[k], " on periwinkle", r2(CARD[k], CARD.periwinkle));
}

say("");
say("── The dark close (Onyx) ───────────────────────────────────────────────────────");
say("white on onyx      ", r2(WHITE, CARD.onyx));
say("white@75% on onyx  ", r2(over(WHITE, CARD.onyx, 0.75), CARD.onyx));
say("amber on onyx      ", r2(CARD.amber, CARD.onyx));
say("stone on onyx      ", r2(STONE, CARD.onyx), "(must fail — kept illegal)");

say("");
say("── Neutrals, unchanged, re-measured against the new ink ────────────────────────");
say("ink on paper       ", r2(CARD.onyx, PAPER));
say("ink on white       ", r2(CARD.onyx, WHITE));
say("stone on paper     ", r2(STONE, PAPER));
say("pebble on paper    ", r2(PEBBLE, PAPER));
say("hairline on paper  ", r2("#e3e1de", PAPER));
say("hairline-strong    ", r2("#c9c5c0", PAPER));
say("control on paper   ", r2("#8a857e", PAPER));
say("selection: amber ground, amber button ink =", r2(AMBER_BUTTON_INK, CARD.amber));

console.log(out.join("\n"));

import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:3320";
const OUT = process.argv[2];
const STYLES = ["flat", "gradient", "mesh", "grain", "pattern"];
const LAYOUTS = ["classic", "banner", "hero", "minimal"];
const PATTERNS = ["grid", "dots", "hatch", "arcs", "topo"];
const VIEWPORTS = { d: { width: 1440, height: 900 }, m: { width: 360, height: 800 } };

const problems = [];

const browser = await chromium.launch();

async function shoot(page, name, url) {
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const diag = await page.evaluate(() => {
    const de = document.documentElement;
    const root = document.querySelector("[data-card-root]");
    return {
      hOverflowDoc: de.scrollWidth - de.clientWidth,
      hOverflowCard: root ? root.scrollWidth - root.clientWidth : null,
      groundPos: getComputedStyle(document.querySelector("[data-card-ground]")).position,
    };
  });
  if (diag.hOverflowDoc > 0 || (diag.hOverflowCard ?? 0) > 0) problems.push(`${name}: horizontal overflow ${JSON.stringify(diag)}`);
  if (diag.groundPos !== "fixed") problems.push(`${name}: ground is ${diag.groundPos}, expected fixed`);
  if (errs.length) problems.push(`${name}: console ${JSON.stringify(errs)}`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

for (const [vk, vp] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // styles x dark/light, layout classic (ground fully exposed)
  for (const style of STYLES) {
    for (const pal of ["onyx", "amber"]) {
      await shoot(page, `${vk}-style-${style}-${pal}`, `${BASE}/zz-surface?style=${style}&palette=${pal}&layout=classic`);
    }
  }
  // header layouts
  for (const layout of LAYOUTS) {
    for (const pal of ["sapphire", "pistachio"]) {
      await shoot(page, `${vk}-layout-${layout}-${pal}`, `${BASE}/zz-surface?style=gradient&palette=${pal}&layout=${layout}`);
    }
  }
  // patterns
  for (const p of PATTERNS) {
    await shoot(page, `${vk}-pattern-${p}-oxblood`, `${BASE}/zz-surface?style=pattern&pattern=${p}&palette=oxblood&layout=classic`);
    await shoot(page, `${vk}-pattern-${p}-periwinkle`, `${BASE}/zz-surface?style=pattern&pattern=${p}&palette=periwinkle&layout=banner`);
  }
  // the real page
  await shoot(page, `${vk}-live-prya-hq`, `${BASE}/c/prya-hq`);
  await ctx.close();
}

// ── the ground holds still ────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/zz-surface?style=pattern&pattern=topo&palette=emerald&layout=classic`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => {
    const g = document.querySelector("[data-card-ground]").getBoundingClientRect();
    const n = document.querySelector("[data-card-name]").getBoundingClientRect();
    return { g: { top: g.top, left: g.left, h: g.height, w: g.width }, nameTop: n.top, y: window.scrollY };
  });
  await page.screenshot({ path: `${OUT}/still-0-before.png` });
  await page.evaluate(() => window.scrollTo(0, 520));
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => {
    const g = document.querySelector("[data-card-ground]").getBoundingClientRect();
    const n = document.querySelector("[data-card-name]").getBoundingClientRect();
    return { g: { top: g.top, left: g.left, h: g.height, w: g.width }, nameTop: n.top, y: window.scrollY };
  });
  await page.screenshot({ path: `${OUT}/still-1-after.png` });
  fs.writeFileSync(`${OUT}/still.json`, JSON.stringify({ before, after }, null, 2));
  if (before.g.top !== after.g.top || before.g.height !== after.g.height) {
    problems.push(`ground moved: ${JSON.stringify({ before: before.g, after: after.g })}`);
  }
  if (before.nameTop === after.nameTop) problems.push("content did NOT scroll — test is meaningless");
  await ctx.close();
}

// ── reduced motion, and the animation-killed default ──────────────────────
{
  for (const rm of ["reduce", "no-preference"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, reducedMotion: rm === "reduce" ? "reduce" : "no-preference" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/c/prya-hq`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900);
    const vis = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("[data-card-fields] > li")];
      return rows.map((r) => ({ op: getComputedStyle(r).opacity, tr: getComputedStyle(r).translate }));
    });
    fs.writeFileSync(`${OUT}/motion-${rm}.json`, JSON.stringify(vis, null, 2));
    if (vis.some((v) => v.op !== "1")) problems.push(`${rm}: a row settled at opacity ${JSON.stringify(vis)}`);
    await ctx.close();
  }
  // the harness's kill stylesheet: rows must be at their final state instantly
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const page = await ctx.newPage();
  await page.addStyleTag; // noop
  await page.goto(`${BASE}/c/prya-hq`, { waitUntil: "commit" });
  await page.addStyleTag({ content: `*,*::before,*::after{animation-duration:0s !important;animation-delay:0s !important;transition-duration:0s !important;transition-delay:0s !important}` }).catch(() => {});
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  const killed = await page.evaluate(() => [...document.querySelectorAll("[data-card-fields] > li")].map((r) => getComputedStyle(r).opacity));
  fs.writeFileSync(`${OUT}/motion-killed.json`, JSON.stringify(killed));
  if (killed.some((o) => o !== "1")) problems.push(`animation-killed: rows at ${JSON.stringify(killed)}`);
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/problems.json`, JSON.stringify(problems, null, 2));
console.log(problems.length === 0 ? "NO PROBLEMS" : problems.join("\n"));

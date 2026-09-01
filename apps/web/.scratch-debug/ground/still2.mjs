import { chromium } from "@playwright/test";
import fs from "node:fs";
const OUT = process.argv[2];
const b = await chromium.launch();
const out = [];
async function run(name, vp, url, clip, by) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelectorAll('body > div[hidden][id^="S:"]').length === 0);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1200); // let the one authored moment finish
  const m0 = await p.evaluate(() => ({
    y: scrollY,
    scrollable: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    name: document.querySelector("main [data-card-name]").getBoundingClientRect().top,
    ground: document.querySelector("main [data-card-ground]").getBoundingClientRect(),
    pos: getComputedStyle(document.querySelector("main [data-card-ground]")).position,
  }));
  const a = await p.screenshot({ clip });
  await p.evaluate((n) => scrollBy(0, n), by);
  await p.waitForTimeout(400);
  const m1 = await p.evaluate(() => ({
    y: scrollY,
    name: document.querySelector("main [data-card-name]").getBoundingClientRect().top,
    ground: document.querySelector("main [data-card-ground]").getBoundingClientRect(),
  }));
  const c = await p.screenshot({ clip });
  fs.writeFileSync(`${OUT}/${name}-before.png`, a);
  fs.writeFileSync(`${OUT}/${name}-after.png`, c);
  out.push({ name, position: m0.pos, scrollable: m0.scrollable, scrolled: m1.y - m0.y,
    nameMoved: +(m1.name - m0.name).toFixed(2),
    groundTopBefore: m0.ground.top, groundTopAfter: m1.ground.top,
    groundHeight: m0.ground.height, viewportH: vp.height,
    groundPixelsIdentical: Buffer.compare(a, c) === 0 });
  await ctx.close();
}
await run("proof-1440", { width: 1440, height: 420 }, "http://localhost:3320/c/prya-hq",
  { x: 120, y: 60, width: 240, height: 300 }, 260);
await run("proof-768", { width: 768, height: 420 }, "http://localhost:3320/c/prya-pay",
  { x: 20, y: 60, width: 100, height: 300 }, 200);
await b.close();
console.log(JSON.stringify(out, null, 2));

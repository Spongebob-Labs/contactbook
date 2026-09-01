import { chromium } from "@playwright/test";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto("http://localhost:3320/c/prya-hq", { waitUntil: "load" });
await p.waitForFunction(() => document.querySelectorAll('body > div[hidden][id^="S:"]').length === 0);
await p.waitForTimeout(900);
const btn = p.locator('[data-card-action-button="field_work_email"]').first();
const save = p.locator('[data-card-action="save"]').first();
const read = async (l) => l.evaluate((n) => { const c = getComputedStyle(n); return { translate: c.translate, boxShadow: c.boxShadow.slice(0, 90), transition: c.transitionProperty }; });
console.log("field rest ", await read(btn));
await btn.hover(); await p.waitForTimeout(250);
console.log("field hover", await read(btn));
await p.mouse.down(); await p.waitForTimeout(150);
console.log("field press", await read(btn));
await p.mouse.up();
console.log("save rest  ", await read(save));
await save.hover(); await p.waitForTimeout(250);
console.log("save hover ", await read(save));
// scrollbar theming
console.log("scrollbar", await p.evaluate(() => {
  const de = document.documentElement;
  const c = getComputedStyle(de);
  return { attr: de.getAttribute("data-card-page-scroll"), width: c.scrollbarWidth, color: c.scrollbarColor };
}));
// selection + tabular figures + link underline
console.log("surfaces", await p.evaluate(() => {
  const v = document.querySelector("[data-card-field-value]");
  const a = document.querySelector("[data-public-card-made-with] a");
  return {
    numeric: getComputedStyle(v).fontVariantNumeric,
    underlineOffset: getComputedStyle(a).textUnderlineOffset,
    underlineThickness: getComputedStyle(a).textDecorationThickness,
    heroOnPalette: document.querySelector("[data-card-hero]").getAttribute("data-card-on-palette"),
    bodyOnPalette: document.querySelector("[data-card-body]").getAttribute("data-card-on-palette"),
  };
}));
await b.close();

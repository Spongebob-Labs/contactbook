import { chromium } from "@playwright/test";
const OUT = process.argv[2];
const b = await chromium.launch();
for (const [k, vp] of [["1440", { width: 1440, height: 900 }], ["360", { width: 360, height: 800 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  for (const [name, slug] of [["hq", "prya-hq"], ["pay", "prya-pay"], ["blank", "prya-blank"], ["stage", "prya-stage"]]) {
    await p.goto(`http://localhost:3320/c/${slug}`, { waitUntil: "load" });
    await p.waitForFunction(() => document.querySelectorAll('body > div[hidden][id^="S:"]').length === 0);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/final-${k}-${name}.png`, fullPage: false });
  }
  await ctx.close();
}
await b.close();
console.log("done");

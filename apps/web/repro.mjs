import { chromium } from "@playwright/test";
const OUT = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 430, height: 1400 }, deviceScaleFactor: 2 });
await p.goto("http://localhost:3000/cards/card_minimal_demo", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
const m = await p.evaluate(() => {
  const face = document.querySelector('[data-card-variant="face"]');
  const rail = document.querySelector("[data-wallet-pass-rail]");
  const block = document.querySelector("[data-wallet-pass]");
  const btn = [...document.querySelectorAll("button")].find(n => /Save to contacts/.test(n.textContent||""));
  const r = (n) => n ? { l: Math.round(n.getBoundingClientRect().left), r: Math.round(n.getBoundingClientRect().right), t: Math.round(n.getBoundingClientRect().top), b: Math.round(n.getBoundingClientRect().bottom), w: Math.round(n.getBoundingClientRect().width) } : null;
  return {
    face: r(face), rail: r(rail), block: r(block), btn: r(btn),
    railOverflowX: rail ? getComputedStyle(rail).overflowX : null,
    railScrollW: rail ? rail.scrollWidth : null,
    railClientW: rail ? rail.clientWidth : null,
    btnParentInRail: btn ? btn.closest("[data-wallet-pass-rail]") !== null : null,
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
  };
});
console.log(JSON.stringify(m, null, 1));
await p.locator("[data-wallet-pass]").screenshot({ path: `${OUT}/glitch-430.png` });
await p.close();
await b.close();

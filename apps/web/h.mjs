import { chromium } from "@playwright/test";
const OUT = process.argv[2];
const b = await chromium.launch();
for (const [name, w] of [["1440",1440],["1280",1280],["1920",1920]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  // measure the collision: headline glyph extents vs leftmost card extent
  const m = await p.evaluate(() => {
    const h1 = document.querySelector("[data-hero-headline]");
    const lines = [...h1.querySelectorAll("span")].map(s => {
      const r = document.createRange(); r.selectNodeContents(s);
      return r.getBoundingClientRect().right;
    });
    const cards = [...document.querySelectorAll("[data-hero-fan-card]")]
      .map(n => n.getBoundingClientRect());
    const fan = document.querySelector("[data-hero-fan]");
    return {
      headlineRight: Math.max(...lines),
      cardLeft: cards.length ? Math.min(...cards.map(c => c.left)) : null,
      cardRight: cards.length ? Math.max(...cards.map(c => c.right)) : null,
      fanVisible: fan ? getComputedStyle(fan).display : "absent",
      vw: window.innerWidth,
    };
  });
  m.clearsBy = m.cardLeft == null ? "n/a" : Math.round(m.cardLeft - m.headlineRight);
  console.log(name + ": " + JSON.stringify(m));
  await p.screenshot({ path: `${OUT}/fan-${name}.png` });
  await p.close();
}
await b.close();

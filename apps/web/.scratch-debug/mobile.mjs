import { chromium } from '@playwright/test';
const OUT = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await p.goto('http://localhost:3100/', { waitUntil:'networkidle' });
await p.waitForTimeout(1000);
for (const id of ['hero','card','broadcast','assistant','templates','trust','pricing','start']) {
  const el = await p.$(`[data-section="${id}"]`);
  if (el) await el.screenshot({ path:`${OUT}/m-${id}.png`, animations:'disabled' });
}
// Anything wider than the viewport?
const wide = await p.evaluate(() => {
  const bad = [];
  document.querySelectorAll('main *').forEach(n => {
    const r = n.getBoundingClientRect();
    if (r.width > window.innerWidth + 1 && !n.closest('[data-template-rail]')) {
      bad.push({ tag: n.tagName, cls: (n.className||'').toString().slice(0,60), w: Math.round(r.width) });
    }
  });
  return bad.slice(0,8);
});
console.log('OVERWIDE (excluding the rail, which scrolls):', JSON.stringify(wide,null,1));
await b.close();

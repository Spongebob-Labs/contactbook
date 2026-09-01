import { chromium } from '@playwright/test';
const OUT = process.argv[2] ?? '.scratch-debug/ground/reskin';
const URL = process.argv[3] ?? 'http://localhost:3340/';
const b = await chromium.launch();
const errs = [];
for (const [name, w, h] of [['1440x900', 1440, 900], ['360x800', 360, 800]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  p.on('console', m => { if (m.type() === 'error') errs.push(`${name}: ${m.text().slice(0,200)}`); });
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message.slice(0,200)}`));
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/full-${name}.png`, fullPage: true, animations: 'disabled' });
  await p.screenshot({ path: `${OUT}/fold-${name}.png`, animations: 'disabled' });
  const ids = await p.$$eval('[data-section]', ns => ns.map(n => n.dataset.section));
  for (const id of ids) {
    const el = await p.$(`[data-section="${id}"]`);
    if (el) await el.screenshot({ path: `${OUT}/${name}-sec-${id}.png`, animations: 'disabled' });
  }
  const geo = await p.evaluate(() => {
    const de = document.documentElement;
    const cs = (sel, prop) => { const n = document.querySelector(sel); return n ? getComputedStyle(n)[prop] : null; };
    const h1 = document.querySelector('[data-hero-headline]');
    return {
      hOverflow: de.scrollWidth - de.clientWidth,
      height: de.scrollHeight,
      h1Font: h1 && getComputedStyle(h1).fontFamily,
      h1Size: h1 && getComputedStyle(h1).fontSize,
      h1Track: h1 && getComputedStyle(h1).letterSpacing,
      h1Weight: h1 && getComputedStyle(h1).fontWeight,
      h1Lines: h1 && Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)),
      ctaBg: cs('[data-hero-cta]', 'backgroundColor'),
      ctaFg: cs('[data-hero-cta]', 'color'),
      sky: cs('.mk-sky', 'backgroundImage'),
      tones: [...document.querySelectorAll('[data-section]')].map(n => [n.dataset.section, n.dataset.tone, getComputedStyle(n.querySelector('[data-pass]') ?? n).backgroundColor]),
    };
  });
  console.log(name, JSON.stringify(geo, null, 1));
  await p.close();
}
await b.close();
console.log('CONSOLE ERRORS:', errs.length ? JSON.stringify(errs.slice(0,10), null, 1) : 'none');

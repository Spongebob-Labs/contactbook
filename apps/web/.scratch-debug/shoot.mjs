import { chromium } from '@playwright/test';
const OUT = process.argv[2];
const b = await chromium.launch();
const errs = [];

for (const [name, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  p.on('console', m => { if (m.type() === 'error') errs.push(`${name}: ${m.text().slice(0,200)}`); });
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message.slice(0,200)}`));
  await p.goto('http://localhost:3100/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);

  await p.screenshot({ path: `${OUT}/full-${name}.png`, fullPage: true, animations: 'disabled' });

  // Per-section, desktop only — this is what I need to judge each band.
  if (name === 'desktop') {
    const ids = await p.$$eval('[data-section]', ns => ns.map(n => n.dataset.section));
    for (const id of ids) {
      const el = await p.$(`[data-section="${id}"]`);
      if (el) await el.screenshot({ path: `${OUT}/sec-${id}.png`, animations: 'disabled' });
    }
    const geo = await p.evaluate(() => {
      const de = document.documentElement;
      return { hOverflow: de.scrollWidth - de.clientWidth, height: de.scrollHeight,
               sections: document.querySelectorAll('[data-section]').length };
    });
    console.log('DESKTOP', JSON.stringify(geo));
  } else {
    const geo = await p.evaluate(() => {
      const de = document.documentElement;
      return { hOverflow: de.scrollWidth - de.clientWidth, height: de.scrollHeight };
    });
    console.log('MOBILE', JSON.stringify(geo));
  }
  await p.close();
}
await b.close();
console.log('ERRORS', errs.length ? JSON.stringify(errs.slice(0,10), null, 1) : 'none');

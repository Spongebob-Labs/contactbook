import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,160)); });
p.on('pageerror', e => errs.push('pageerror: '+e.message.slice(0,160)));
for (const route of ['/templates', '/signin/phone', '/dashboard', '/c/prya-hq']) {
  try {
    const r = await p.goto('http://localhost:3100'+route, { waitUntil:'domcontentloaded', timeout: 25000 });
    await p.waitForTimeout(900);
    const info = await p.evaluate(() => ({
      title: document.title.slice(0,50),
      h1: document.querySelector('h1,h2')?.textContent?.trim().slice(0,45) ?? null,
      hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      nav: !!document.querySelector('[data-pill-nav]'),
    }));
    console.log(route.padEnd(16), r.status(), JSON.stringify(info));
  } catch (e) { console.log(route.padEnd(16), 'ERR', e.message.slice(0,90)); }
}
await b.close();
console.log('CONSOLE ERRORS:', errs.length ? JSON.stringify([...new Set(errs)].slice(0,6),null,1) : 'none');

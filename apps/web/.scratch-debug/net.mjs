import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:900} });
const bad = [];
p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
for (const route of ['/', '/templates', '/c/prya-hq']) {
  await p.goto('http://localhost:3100' + route, { waitUntil:'networkidle' });
  await p.waitForTimeout(700);
}
console.log(bad.length ? JSON.stringify([...new Set(bad)], null, 1) : 'no 4xx/5xx');
await b.close();

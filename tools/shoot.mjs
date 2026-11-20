// Playwright screenshot tool for look-dev.
// usage: node tools/shoot.mjs <outDir> [page=lookdev-farm.html] [views=corn,road,wide] [q=high]
import { chromium } from 'playwright';
import fs from 'node:fs';

const [outDir = 'shots', page = 'lookdev-farm.html', views = 'corn,road,wide', q = 'high'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
for (const v of views.split(',')) {
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  p.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await p.goto(`http://[::1]:5173/${page}?view=${v}&q=${q}&shot`, { waitUntil: 'load' });
  try { await p.waitForFunction(() => window.__ready === true, null, { timeout: 90000 }); }
  catch { logs.push('[timeout] scene never reported ready'); }
  await p.waitForTimeout(1500);
  const fps = await p.evaluate(() => document.getElementById('hud')?.textContent);
  await p.screenshot({ path: `${outDir}/${v}.png` });
  console.log(`${v}: ${fps}`);
  for (const l of logs.filter((l) => !l.includes('[vite]'))) console.log('  ', l.slice(0, 400));
  await p.close();
}
await browser.close();

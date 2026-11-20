// Scripted play-through for testing. usage:
//   node tools/play.mjs <outDir> "<query>" "<steps>"
// steps: comma separated: wait:ms | down:Key | up:Key | tap:Key | shot:name | eval:js | until:js
import { chromium } from 'playwright';
import fs from 'node:fs';

const [outDir = 'shots', query = '', steps = ''] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const logs = [];
page.on('console', (m) => { if (m.type() !== 'debug') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://[::1]:5173/index.html?shot&${query}`, { waitUntil: 'load' });
try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }); } catch { logs.push('[timeout] not ready'); }
for (const step of steps.split(';;').map((s) => s.trim()).filter(Boolean)) {
  const i = step.indexOf(':'); const op = step.slice(0, i), arg = step.slice(i + 1);
  if (op === 'wait') await page.waitForTimeout(+arg);
  else if (op === 'down') await page.keyboard.down(arg);
  else if (op === 'up') await page.keyboard.up(arg);
  else if (op === 'tap') { await page.keyboard.down(arg); await page.waitForTimeout(80); await page.keyboard.up(arg); }
  else if (op === 'shot') { await page.screenshot({ path: `${outDir}/${arg}.png` }); const fps = await page.evaluate(() => document.querySelector('.debug')?.textContent); console.log(`shot ${arg}: ${fps}`); }
  else if (op === 'eval') console.log('eval', arg, '=>', JSON.stringify(await page.evaluate(arg)));
  else if (op === 'until') { try { await page.waitForFunction(arg, null, { timeout: 120000 }); } catch { console.log('until timeout', arg); } }
}
for (const l of logs) if (!/vite|PCFSoft|Clock/.test(l)) console.log('  ', l.slice(0, 300));
await browser.close();

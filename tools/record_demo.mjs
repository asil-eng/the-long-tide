// Records demo clips of the game with Playwright's video capture, one page per clip.
// usage: node tools/record_demo.mjs <outDir>   (dev server must be running)
// Prints "clip <name> <startSeconds> <durationSeconds>" so the clips can be trimmed and joined.
import { chromium } from 'playwright';
import fs from 'node:fs';

const out = process.argv[2] || 'demo';
fs.mkdirSync(out, { recursive: true });
const HIDE = "document.querySelector('.debug')&&(document.querySelector('.debug').style.display='none')";
const aim = '(()=>{const b=__level.balloon.group.position;__level.aimTruckAt(b.x,b.z)})()';
const enterTruck = '__game.player.setPosition(__game.truck.doorPoint.setY(0.1), 0)';

const CLIPS = [
  { name: 'title', q: '', dur: 4, steps: [] },
  { name: 'opening', q: 'scene=1', dur: 22, steps: [] },
  { name: 'chase', q: 'scene=2', dur: 13, pre: async (p) => {
      await p.evaluate(enterTruck); await p.waitForTimeout(300); await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
      await p.keyboard.down('KeyW'); },
    during: async (p) => { for (let i = 0; i < 6; i++) { await p.evaluate(aim); await p.waitForTimeout(2200); } } },
  { name: 'storm', q: 'scene=3', dur: 11, pre: async (p) => { await p.evaluate("__game.player.setPosition({x:-2,y:0,z:6},Math.PI)"); } },
  { name: 'puzzle', q: 'scene=3', dur: 9, pre: async (p) => {
      await p.waitForTimeout(9000); await p.evaluate('__level.goInside()'); await p.waitForTimeout(1800);
      await p.evaluate("__game.player.setPosition({x:621.1,y:0,z:620.75},Math.PI/2)"); await p.waitForTimeout(600);
      await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
      for (let i = 0; i < 4; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(150); } await p.waitForTimeout(800); },
    during: async (p) => { await p.keyboard.down('KeyS'); await p.waitForTimeout(1380); await p.keyboard.up('KeyS'); await p.keyboard.down('KeyA'); await p.waitForTimeout(1500); await p.keyboard.up('KeyA'); } },
  { name: 'observatory', q: 'scene=4', dur: 16, pre: async (p) => {
      // walk up to the gate on foot: Dr. Okafor's cutscene starts when you get close
      await p.evaluate("__game.player.setPosition({x:146,y:12,z:-158}, -Math.PI/2)"); await p.waitForTimeout(400); } },
  { name: 'launch', q: 'scene=5', dur: 27, pre: async (p) => {
      await p.waitForTimeout(4500); await p.evaluate('__level.goInside()'); await p.waitForTimeout(1800);
      await p.evaluate("__game.player.setPosition({x:619.6,y:0,z:619.4},0.4)"); await p.waitForTimeout(600);
      await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
      for (let i = 0; i < 16; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(120); }
      await p.evaluate("(()=>{const s=__level.bedroom.shelf;__game.player.setPosition({x:(s.min.x+s.max.x)/2,y:0,z:s.max.z+0.65},Math.PI)})()");
      await p.waitForTimeout(500); await p.keyboard.press('KeyE'); await p.waitForTimeout(500);
      await p.evaluate('__level.goOutside()'); await p.waitForTimeout(1800);
      await p.evaluate(enterTruck); await p.waitForTimeout(300); await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
      await p.evaluate("__game.truck.body.setTranslation({x:70,y:2,z:40},true)"); await p.waitForTimeout(900); } },
];

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const c of CLIPS.filter((c) => !process.env.ONLY || process.env.ONLY.split(',').includes(c.name))) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
  const p = await ctx.newPage();
  const t0 = Date.now();
  await p.goto(`http://[::1]:5173/index.html?${c.q}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await p.evaluate(HIDE);
  if (c.pre) await c.pre(p);
  const start = (Date.now() - t0) / 1000;
  if (c.during) await Promise.all([c.during(p), p.waitForTimeout(c.dur * 1000)]); else await p.waitForTimeout(c.dur * 1000);
  const video = p.video();
  await ctx.close();
  const path = `${out}/${c.name}.webm`;
  fs.renameSync(await video.path(), path);
  console.log(`clip ${c.name} ${start.toFixed(2)} ${c.dur}`);
}
await browser.close();

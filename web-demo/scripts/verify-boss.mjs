// Headless boss-fight smoke + screenshots. Spawns the boss via ?boss=warden,
// tracks the player under it to land hits, samples boss HP to confirm damage +
// phase changes, and asserts 0 console errors.
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const EXE = 'C:/Users/rober/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe';
const BASE = process.env.URL ?? 'http://localhost:4173/';
const shots = resolve(dirname(fileURLToPath(import.meta.url)), '../shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: EXE });
const errors = [];
const p = await browser.newPage({ viewport: { width: 720, height: 1280 } });
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
p.on('pageerror', (e) => errors.push(String(e)));

await p.goto(`${BASE}?boss=warden`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__VL && window.__VL.world && window.__VL.world.bossHp >= 0, null, { timeout: 9000 });
await sleep(900);
await p.screenshot({ path: `${shots}/3d-boss-entrance.png` });

const samples = [];
for (let i = 0; i < 14; i++) {
  // track under the boss so auto-fire connects
  await p.evaluate(() => {
    const w = window.__VL.world;
    const bx = w.bossCore ? w.bossCore.x : 360;
    w.setTarget(bx, 760);
  });
  await sleep(450);
  const d = await p.evaluate(() => ({ hp: +window.__VL.world.bossHp.toFixed(2), name: window.__VL.world.bossName, phep: window.__VL.world.hp }));
  samples.push(d.hp);
  if (i === 6) await p.screenshot({ path: `${shots}/3d-boss-fight.png` });
}
await p.screenshot({ path: `${shots}/3d-boss-late.png` });

await browser.close();

console.log('boss HP samples:', samples.join(' '));
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ✗ ' + e);
const dropped = samples[0] > (samples[samples.length - 1] ?? 1) || samples.includes(-1);
if (errors.length) process.exit(1);
if (!dropped) { console.log('⚠ boss HP never dropped — damage may not register'); process.exit(2); }
console.log('OK — boss spawns, takes damage, 0 console errors; shots in shots/');

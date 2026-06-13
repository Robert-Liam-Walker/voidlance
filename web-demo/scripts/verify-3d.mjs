// Headless smoke + screenshots for the 3D build. Launches cached Chromium via
// playwright-core, captures the menu and each level (?lvl=N), drives the player
// to exercise movement/banking/combat, and asserts 0 console errors. FPS is
// SwiftShader/software here — relative sanity only; real 60fps gate = Robert.
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const EXE = 'C:/Users/rober/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe';
const BASE = process.env.URL ?? 'http://localhost:4173/';
const shots = resolve(dirname(fileURLToPath(import.meta.url)), '../shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: EXE });
const errors = [];

async function page() {
  const p = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(String(e)));
  return p;
}

// menu
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__VL, null, { timeout: 8000 });
  await sleep(700);
  await p.screenshot({ path: `${shots}/3d-menu.png` });
  await p.close();
  console.log('menu captured');
}

console.log('levels:');
const names = [];
for (let lvl = 0; lvl < 5; lvl++) {
  const p = await page();
  await p.goto(`${BASE}?lvl=${lvl}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__VL && window.__VL.world, null, { timeout: 8000 });
  // sweep to exercise movement, banking, collisions
  for (const tx of [360, 120, 600, 360]) {
    await p.evaluate((x) => window.__VL.world.setTarget(x, 1000), tx);
    await sleep(450);
  }
  const d = await p.evaluate(() => {
    const w = window.__VL.world;
    return { level: w.levelName, score: w.score, hp: w.hp, enemies: w.forEachCount ? 0 : undefined, fps: window.__VL.fpsAvg };
  });
  names.push(d);
  await p.screenshot({ path: `${shots}/3d-lvl${lvl}.png` });
  console.log(`  lvl${lvl}  "${d.level}"  score=${d.score} hp=${d.hp} fps=${d.fps}`);
  await p.close();
}

await browser.close();

console.log(`\nconsole errors: ${errors.length}`);
for (const e of errors) console.log('  ✗ ' + e);
const anyScore = names.some((n) => n.score > 0);
if (errors.length) process.exit(1);
if (!anyScore) {
  console.log('⚠ no score across any level — combat loop may be broken');
  process.exit(2);
}
console.log('OK — 0 console errors, combat advancing across levels, shots in shots/');

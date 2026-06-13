// Headless schema-first validation of the canonical shared-data/.
// Run via `npm run validate:data`. Exits non-zero on any schema or
// referential-integrity error (fail hard). Mirrors the in-game loader checks.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', 'shared-data');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readDir = (d) =>
  existsSync(join(root, d))
    ? readdirSync(join(root, d)).filter((f) => f.endsWith('.json')).map((f) => readJson(join(root, d, f)))
    : [];

const ajv = new Ajv({ allErrors: true, strict: false });
for (const f of readdirSync(join(root, 'schema'))) {
  if (f.endsWith('.json')) ajv.addSchema(readJson(join(root, 'schema', f)));
}

const errors = [];
const validateList = (items, schemaId, idOf) => {
  const v = ajv.getSchema(schemaId);
  if (!v) { errors.push(`missing schema ${schemaId}`); return items; }
  for (const it of items) if (!v(it)) errors.push(`${schemaId} :: ${idOf(it)} :: ${ajv.errorsText(v.errors)}`);
  return items;
};

const enemies = validateList(readDir('enemies'), 'enemy.schema.json', (e) => e.id);
const levels = validateList(readDir('levels'), 'level.schema.json', (l) => l.id);
const bosses = validateList(readDir('bosses'), 'boss.schema.json', (b) => b.id);
const powerups = validateList(readDir('powerups'), 'powerup.schema.json', (p) => p.id);
const themes = validateList(readDir('themes'), 'theme.schema.json', (t) => t.id);
const economy = readJson(join(root, 'economy.json'));
validateList([economy], 'economy.schema.json', () => 'economy');

const has = (arr, id) => arr.some((x) => x.id === id);
for (const t of themes) {
  for (const id of t.enemyRosterIds) if (!has(enemies, id)) errors.push(`theme ${t.id}: missing enemy ${id}`);
  for (const id of t.powerupIds || []) if (!has(powerups, id)) errors.push(`theme ${t.id}: missing powerup ${id}`);
  for (const id of t.levelIds) {
    const lvl = levels.find((l) => l.id === id);
    if (!lvl) { errors.push(`theme ${t.id}: missing level ${id}`); continue; }
    for (const w of lvl.waves)
      if (w.rosterIndex >= t.enemyRosterIds.length)
        errors.push(`level ${id}: rosterIndex ${w.rosterIndex} out of range for theme ${t.id} (roster=${t.enemyRosterIds.length})`);
    if (lvl.bossId && !has(bosses, lvl.bossId)) errors.push(`level ${id}: missing boss ${lvl.bossId}`);
  }
}

if (errors.length) {
  console.error(`[validate-data] FAIL (${errors.length}):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(
  `[validate-data] OK — ${enemies.length} enemies, ${levels.length} levels, ${bosses.length} bosses, ${powerups.length} powerups, ${themes.length} themes, ${economy.upgrades.length} upgrades`
);

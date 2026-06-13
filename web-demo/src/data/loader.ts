import Ajv from 'ajv';
import type { EnemyDef, LevelDef, PowerUpDef, ThemeDef, EconomyDef, WaveDef } from './types';

// Canonical data is mirrored into src/shared-data.generated/ by scripts/sync-data.mjs
// (build output, gitignored). We import + validate it against the same schemas.
interface JsonModule<T> { default: T }
const schemaModules = import.meta.glob('../shared-data.generated/schema/*.json', { eager: true });
const enemyModules = import.meta.glob('../shared-data.generated/enemies/*.json', { eager: true });
const levelModules = import.meta.glob('../shared-data.generated/levels/*.json', { eager: true });
const powerupModules = import.meta.glob('../shared-data.generated/powerups/*.json', { eager: true });
const themeModules = import.meta.glob('../shared-data.generated/themes/*.json', { eager: true });
const economyModules = import.meta.glob('../shared-data.generated/economy.json', { eager: true });

function vals<T>(mods: Record<string, unknown>): T[] {
  return Object.values(mods).map((m) => (m as JsonModule<T>).default);
}

export interface GameData {
  enemies: EnemyDef[];
  levels: LevelDef[];
  powerups: PowerUpDef[];
  themes: ThemeDef[];
  economy: EconomyDef;
  enemy(id: string): EnemyDef | undefined;
  level(id: string): LevelDef | undefined;
  powerup(id: string): PowerUpDef | undefined;
  theme(id: string): ThemeDef | undefined;
  enemyForWave(theme: ThemeDef, wave: WaveDef): EnemyDef;
}

let cached: GameData | null = null;

/** Builds + validates the data registries. Throws hard on any schema or reference error. */
export function initData(): GameData {
  if (cached) return cached;

  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const s of vals<unknown>(schemaModules)) ajv.addSchema(s as object);

  const validate = <T>(items: T[], schemaId: string, idOf: (t: T) => string): T[] => {
    const v = ajv.getSchema(schemaId);
    if (!v) throw new Error(`[data] missing schema ${schemaId}`);
    for (const it of items) {
      if (!v(it)) throw new Error(`[data] ${schemaId} invalid (${idOf(it)}): ${ajv.errorsText(v.errors)}`);
    }
    return items;
  };

  const enemies = validate(vals<EnemyDef>(enemyModules), 'enemy.schema.json', (e) => e.id);
  const levels = validate(vals<LevelDef>(levelModules), 'level.schema.json', (l) => l.id);
  const powerups = validate(vals<PowerUpDef>(powerupModules), 'powerup.schema.json', (p) => p.id);
  const themes = validate(vals<ThemeDef>(themeModules), 'theme.schema.json', (t) => t.id);
  const economy = validate(vals<EconomyDef>(economyModules), 'economy.schema.json', () => 'economy')[0];
  if (!economy) throw new Error('[data] economy.json missing');
  if (themes.length === 0) throw new Error('[data] no themes found');

  const enemyById = new Map(enemies.map((e) => [e.id, e]));
  const levelById = new Map(levels.map((l) => [l.id, l]));
  const powerupById = new Map(powerups.map((p) => [p.id, p]));
  const themeById = new Map(themes.map((t) => [t.id, t]));

  // referential integrity — fail hard, like the headless validator
  for (const t of themes) {
    for (const id of t.enemyRosterIds) if (!enemyById.has(id)) throw new Error(`[data] theme ${t.id}: missing enemy ${id}`);
    for (const id of t.powerupIds ?? []) if (!powerupById.has(id)) throw new Error(`[data] theme ${t.id}: missing powerup ${id}`);
    for (const id of t.levelIds) {
      const lvl = levelById.get(id);
      if (!lvl) throw new Error(`[data] theme ${t.id}: missing level ${id}`);
      for (const w of lvl.waves) {
        if (w.rosterIndex >= t.enemyRosterIds.length) {
          throw new Error(`[data] level ${id}: rosterIndex ${w.rosterIndex} out of range for theme ${t.id}`);
        }
      }
    }
  }

  cached = {
    enemies, levels, powerups, themes, economy,
    enemy: (id) => enemyById.get(id),
    level: (id) => levelById.get(id),
    powerup: (id) => powerupById.get(id),
    theme: (id) => themeById.get(id),
    enemyForWave: (theme, wave) => {
      const e = enemyById.get(theme.enemyRosterIds[wave.rosterIndex]);
      if (!e) throw new Error(`[data] enemyForWave: theme ${theme.id} rosterIndex ${wave.rosterIndex}`);
      return e;
    },
  };
  return cached;
}

export function getData(): GameData {
  if (!cached) throw new Error('[data] initData() not called');
  return cached;
}

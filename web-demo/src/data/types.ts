// TypeScript mirrors of the canonical shared-data/ JSON Schemas.
// shared-data/ is the single source of truth; these types must track the schemas.

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  shape: 'drone' | 'wing' | 'bug' | 'diamond';
  size: number;
  scoreValue: number;
  coinValue: number;
  tint: string;
  speed: number;
  sprite: string;
  bulletSprite: string;
  fireChance?: number;
  bulletSpeed?: number;
}

export interface WaveDef {
  rosterIndex: number;
  rows: number;
  cols: number;
  spacingX: number;
  spacingY: number;
  startY: number;
  entryStaggerMs: number;
  diveIntervalMs?: number;
}

export interface LevelDef {
  id: string;
  name: string;
  waves: WaveDef[];
}

export interface PowerUpDef {
  id: string;
  name: string;
  type: 'rapidFire' | 'spread' | 'shield';
  durationMs: number;
  tint: string;
  dropChance: number;
  sprite: string;
}

export interface ThemePalette {
  bg: string;
  bgAccent: string;
  accent: string;
  text: string;
  danger: string;
}

export interface ThemePlayer {
  tint: string;
  bulletTint: string;
  shape: 'arrow' | 'wasp';
  fireRateMs: number;
  bulletSpeed: number;
  bulletDamage: number;
  maxHp: number;
  sprite: string;
  bulletSprite: string;
}

export interface ThemeBackground {
  style: 'starfield' | 'grid';
  starTint: string;
}

export interface ThemeDef {
  id: string;
  name: string;
  tagline: string;
  palette: ThemePalette;
  player: ThemePlayer;
  background: ThemeBackground;
  enemyRosterIds: string[];
  powerupIds?: string[];
  levelIds: string[];
  music?: string;
}

export interface UpgradeDef {
  id: string;
  name: string;
  stat: 'bulletDamage' | 'fireRateMs' | 'maxHp';
  perLevel: number;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
}

export interface EconomyDef {
  upgrades: UpgradeDef[];
}

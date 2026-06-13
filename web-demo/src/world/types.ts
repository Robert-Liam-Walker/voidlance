import type { EnemyDef } from '../data/types';

// One flat entity record for everything the sim simulates, in LOGICAL 720x1280
// coords (y down). Per-kind fields are all present with defaults (set by
// World.spawn) to keep access simple under strict TS.
export type Kind = 'player' | 'enemy' | 'pbullet' | 'ebullet' | 'powerup' | 'barrier' | 'bot' | 'missile' | 'bomb' | 'boss' | 'bosspart';

export type EnemyMode = 'enter' | 'formation' | 'dive' | 'return' | 'active';

export interface Entity {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  vx: number; // achieved velocity (px/s) — drives banking
  vy: number;
  radius: number;
  hp: number;
  alive: boolean;
  color: number;
  scale: number; // visual size hint (logical px) for the renderer

  // projectiles: constant velocity
  bvx: number;
  bvy: number;

  // enemy
  def: EnemyDef | null;
  mode: EnemyMode;
  slotX: number;
  slotY: number;
  row: number;
  col: number;
  fireCd: number;
  actCd: number;
  dir: number;
  phase: number; // also reused as a generic phase counter
  didAct: boolean;

  // enter / dive / return interpolation
  enterDelay: number;
  enterT: number;
  enterDur: number;
  fromX: number;
  fromY: number;
  diveT: number;
  diveDur: number;
  dcx: number;
  dcy: number;
  dex: number;
  dey: number;

  // powerup
  puId: string;

  // timed entities (barrier / bot / bomb)
  ttl: number;
  orbA: number;
  until: number;
  targetY: number;
  bombKind: 'compression' | 'shotgun' | '';
}

// Purely visual effects the renderer drains each frame (the sim never renders).
export type FxEvent =
  | { type: 'burst'; x: number; y: number; color: number; count: number }
  | { type: 'shake'; intensity: number; durMs: number }
  | { type: 'flash'; color: number; durMs: number }
  | { type: 'pop'; x: number; y: number; text: string; color: number }
  | { type: 'beam'; x: number; y0: number; y1: number; color: number; width: number; durMs: number }
  | { type: 'ring'; x: number; y: number; color: number; radius: number };

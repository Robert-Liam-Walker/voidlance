import type { GameData } from './data/loader';
import type { SaveStore } from './systems/Save';
import type { Economy } from './systems/Economy';

// Tiny service locator, initialised once at boot after data validation.
// Single-theme build (NOVA LANCE) — no ThemeManager.
export interface Services {
  data: GameData;
  save: SaveStore;
  economy: Economy;
}

let current: Services | null = null;

export function setServices(s: Services): void {
  current = s;
}

export function services(): Services {
  if (!current) throw new Error('services() used before boot');
  return current;
}

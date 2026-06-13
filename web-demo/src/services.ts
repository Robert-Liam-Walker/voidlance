import type { GameData } from './data/loader';
import type { SaveStore } from './systems/Save';
import type { Economy } from './systems/Economy';
import type { ThemeManager } from './systems/ThemeManager';

// Tiny service locator, initialised once in BootScene after data validation.
export interface Services {
  data: GameData;
  save: SaveStore;
  economy: Economy;
  themes: ThemeManager;
}

let current: Services | null = null;

export function setServices(s: Services): void {
  current = s;
}

export function services(): Services {
  if (!current) throw new Error('services() used before BootScene init');
  return current;
}

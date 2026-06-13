import type { GameData } from '../data/loader';
import type { SaveStore } from './Save';
import type { ThemeDef, UpgradeDef } from '../data/types';

export interface PlayerStats {
  fireRateMs: number;
  bulletSpeed: number;
  bulletDamage: number;
  maxHp: number;
}

// Per-theme soft currency (coins) + upgrade purchases. All numbers come from
// shared-data/economy.json + theme.player — nothing hardcoded here.
export class Economy {
  constructor(private data: GameData, private save: SaveStore) {}

  coins(themeId: string): number {
    return this.save.theme(themeId).coins;
  }
  addCoins(themeId: string, n: number): void {
    this.save.theme(themeId).coins += n;
    this.save.persist();
  }

  upgrades(): UpgradeDef[] {
    return this.data.economy.upgrades;
  }
  level(themeId: string, upgradeId: string): number {
    return this.save.theme(themeId).upgrades[upgradeId] ?? 0;
  }
  cost(themeId: string, upg: UpgradeDef): number {
    return Math.round(upg.baseCost * Math.pow(upg.costGrowth, this.level(themeId, upg.id)));
  }
  isMaxed(themeId: string, upg: UpgradeDef): boolean {
    return this.level(themeId, upg.id) >= upg.maxLevel;
  }
  canBuy(themeId: string, upg: UpgradeDef): boolean {
    return !this.isMaxed(themeId, upg) && this.coins(themeId) >= this.cost(themeId, upg);
  }
  buy(themeId: string, upg: UpgradeDef): boolean {
    if (!this.canBuy(themeId, upg)) return false;
    const t = this.save.theme(themeId);
    t.coins -= this.cost(themeId, upg);
    t.upgrades[upg.id] = this.level(themeId, upg.id) + 1;
    this.save.persist();
    return true;
  }

  bestScore(themeId: string): number {
    return this.save.theme(themeId).bestScore;
  }
  recordScore(themeId: string, score: number): boolean {
    const t = this.save.theme(themeId);
    if (score > t.bestScore) {
      t.bestScore = score;
      this.save.persist();
      return true;
    }
    return false;
  }

  /** Base stats from the theme, modified by purchased upgrades. */
  stats(theme: ThemeDef): PlayerStats {
    const out: PlayerStats = {
      fireRateMs: theme.player.fireRateMs,
      bulletSpeed: theme.player.bulletSpeed,
      bulletDamage: theme.player.bulletDamage,
      maxHp: theme.player.maxHp,
    };
    for (const upg of this.data.economy.upgrades) {
      const lvl = this.level(theme.id, upg.id);
      if (lvl <= 0) continue;
      const delta = upg.perLevel * lvl;
      if (upg.stat === 'bulletDamage') out.bulletDamage += delta;
      else if (upg.stat === 'fireRateMs') out.fireRateMs += delta;
      else if (upg.stat === 'maxHp') out.maxHp += delta;
    }
    out.fireRateMs = Math.max(80, Math.round(out.fireRateMs));
    out.bulletDamage = Math.max(1, Math.round(out.bulletDamage));
    out.maxHp = Math.max(1, Math.round(out.maxHp));
    return out;
  }
}

// Local save (Phase 0: localStorage only — no account/server, per Phase 0 non-goals).
// Versioned + namespaced account.* vs theme.<id>.* per the plan's save invariants.
const STORAGE_KEY = 'voidlance.save';
const SCHEMA_VERSION = 1;

export interface ThemeSave {
  coins: number;
  upgrades: Record<string, number>;
  bestScore: number;
}

export interface SaveData {
  schemaVersion: number;
  updatedAt: number;
  account: { selectedThemeId: string };
  themes: Record<string, ThemeSave>;
}

export class SaveStore {
  data: SaveData;

  constructor(private defaultThemeId: string) {
    this.data = this.load();
  }

  private freshTheme(): ThemeSave {
    return { coins: 0, upgrades: {}, bestScore: 0 };
  }

  private defaults(): SaveData {
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: Date.now(),
      account: { selectedThemeId: this.defaultThemeId },
      themes: {},
    };
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.defaults();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      // (future migrations keyed on parsed.schemaVersion go here)
      if (typeof parsed.schemaVersion !== 'number' || !parsed.account || !parsed.themes) {
        return this.defaults();
      }
      return parsed as SaveData;
    } catch {
      return this.defaults();
    }
  }

  persist(): void {
    this.data.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }

  theme(themeId: string): ThemeSave {
    let t = this.data.themes[themeId];
    if (!t) {
      t = this.freshTheme();
      this.data.themes[themeId] = t;
    }
    return t;
  }
}

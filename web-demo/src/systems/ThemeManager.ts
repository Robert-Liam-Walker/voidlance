import type { GameData } from '../data/loader';
import type { SaveStore } from './Save';
import type { ThemeDef } from '../data/types';

// Active-theme selection. The whole game reads the active ThemeDef; switching
// themes is the "two games in one" hook (Nova Lance <-> Void Hornet).
export class ThemeManager {
  constructor(private data: GameData, private save: SaveStore) {
    if (!this.data.theme(this.save.data.account.selectedThemeId)) {
      this.save.data.account.selectedThemeId = this.data.themes[0].id;
      this.save.persist();
    }
  }

  list(): ThemeDef[] {
    return this.data.themes;
  }
  get activeId(): string {
    return this.save.data.account.selectedThemeId;
  }
  get active(): ThemeDef {
    return this.data.theme(this.activeId) ?? this.data.themes[0];
  }
  setActive(id: string): void {
    if (!this.data.theme(id)) return;
    this.save.data.account.selectedThemeId = id;
    this.save.persist();
  }
}

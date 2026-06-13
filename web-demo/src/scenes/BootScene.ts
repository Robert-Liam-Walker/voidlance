import Phaser from 'phaser';
import { buildTextures } from '../core/textures';
import { initData } from '../data/loader';
import type { GameData } from '../data/loader';
import { SaveStore } from '../systems/Save';
import { Economy } from '../systems/Economy';
import { ThemeManager } from '../systems/ThemeManager';
import { setServices } from '../services';
import { FONT } from '../core/ui';

export class BootScene extends Phaser.Scene {
  private gameData?: GameData;
  private bootError: unknown = null;

  constructor() {
    super('Boot');
  }

  init(): void {
    // Validate canonical data before preload so we can load the sprites it references.
    try {
      this.gameData = initData();
    } catch (err) {
      this.bootError = err;
    }
  }

  preload(): void {
    if (!this.gameData) return;
    const keys = new Set<string>();
    for (const t of this.gameData.themes) {
      keys.add(t.player.sprite);
      keys.add(t.player.bulletSprite);
    }
    for (const e of this.gameData.enemies) {
      keys.add(e.sprite);
      keys.add(e.bulletSprite);
    }
    for (const p of this.gameData.powerups) keys.add(p.sprite);
    for (const k of keys) this.load.image(k, `sprites/${k}.png`);
  }

  create(): void {
    buildTextures(this);
    if (!this.gameData) {
      this.showError(this.bootError);
      return;
    }
    const data = this.gameData;
    const save = new SaveStore(data.themes[0].id);
    setServices({ data, save, economy: new Economy(data, save), themes: new ThemeManager(data, save) });
    this.loadFontsThen(() => this.scene.start('Menu'));
  }

  private loadFontsThen(cb: () => void): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x05030f);
    this.add
      .text(W / 2, H / 2, 'LOADING', { fontFamily: FONT.display, fontStyle: '700', fontSize: '30px', color: '#ffffff' })
      .setOrigin(0.5)
      .setAlpha(0.6);

    let done = false;
    const go = (): void => {
      if (!done) {
        done = true;
        cb();
      }
    };
    this.time.delayedCall(2600, go);

    const docFonts = (document as unknown as { fonts?: { load: (f: string) => Promise<unknown>; ready: Promise<unknown> } }).fonts;
    if (docFonts?.load) {
      Promise.all(['700 24px Orbitron', '900 24px Orbitron', '600 20px Rajdhani', '700 20px Rajdhani'].map((f) => docFonts.load(f)))
        .then(() => docFonts.ready)
        .then(go)
        .catch(go);
    } else {
      go();
    }
  }

  private showError(err: unknown): void {
    const W = this.scale.width;
    this.add.rectangle(W / 2, this.scale.height / 2, W, this.scale.height, 0x140004);
    this.add.text(40, 90, 'DATA VALIDATION FAILED', { fontFamily: 'monospace', fontSize: '30px', color: '#ff5c6e' });
    this.add.text(40, 150, String(err instanceof Error ? err.message : err), {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffb3bd',
      wordWrap: { width: W - 80 },
    });
    console.error(err);
  }
}

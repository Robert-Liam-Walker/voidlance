import Phaser from 'phaser';
import { buildTextures } from '../core/textures';
import { initData } from '../data/loader';
import { SaveStore } from '../systems/Save';
import { Economy } from '../systems/Economy';
import { ThemeManager } from '../systems/ThemeManager';
import { setServices } from '../services';
import { FONT } from '../core/ui';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    buildTextures(this);
    try {
      const data = initData(); // validates canonical data; throws hard on error
      const save = new SaveStore(data.themes[0].id);
      setServices({ data, save, economy: new Economy(data, save), themes: new ThemeManager(data, save) });
    } catch (err) {
      this.showError(err);
      return;
    }
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
    this.time.delayedCall(2600, go); // fallback so we never hang on font load

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

import Phaser from 'phaser';
import { buildTextures } from '../core/textures';
import { initData } from '../data/loader';
import { SaveStore } from '../systems/Save';
import { Economy } from '../systems/Economy';
import { ThemeManager } from '../systems/ThemeManager';
import { setServices } from '../services';

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
      this.scene.start('Menu');
    } catch (err) {
      this.showError(err);
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

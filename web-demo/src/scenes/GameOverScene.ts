import Phaser from 'phaser';
import { services } from '../services';
import { Nebula } from '../core/Nebula';
import { panel, button, heading, label } from '../core/ui';
import { lighten } from '../util/color';

interface GameOverData {
  score: number;
  coins: number;
  best: number;
  isBest: boolean;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: GameOverData): void {
    const theme = services().themes.active;
    const p = theme.palette;
    const W = this.scale.width;
    const H = this.scale.height;
    new Nebula(this, theme);

    heading(this, W / 2, H * 0.24, 'RUN OVER', 60, { ...p, accent: p.danger });
    label(this, W / 2, H * 0.24 + 46, theme.name.toUpperCase(), 22, lighten(p.accent, 0.2), { weight: '700', display: true }).setAlpha(0.9);

    panel(this, W / 2, H * 0.5, 470, 280, p, { fillAlpha: 0.78 });
    const cx = W / 2;
    let ry = H * 0.5 - 96;
    const row = (k: string, v: string, hi = false): void => {
      label(this, cx - 188, ry, k, 22, p.text, { originX: 0, weight: '600' }).setAlpha(0.7);
      label(this, cx + 188, ry, v, 28, hi ? lighten(p.accent, 0.2) : lighten(p.text, 0.1), { originX: 1, weight: '700', display: true });
      ry += 64;
    };
    row('SCORE', `${data.score}`);
    if (data.isBest) {
      label(this, cx, ry, '★ NEW BEST ★', 26, lighten(p.accent, 0.2), { weight: '700', display: true });
      ry += 64;
    } else {
      row('BEST', `${data.best}`);
    }
    row('COINS', `+${data.coins}`, true);

    button(this, W / 2, H * 0.72, 300, 72, 'RETRY', p, () => this.scene.start('Game'), 32);
    button(this, W / 2, H * 0.72 + 86, 300, 60, 'HANGAR', { ...p, accent: p.text }, () => this.scene.start('Menu'), 24);
  }
}

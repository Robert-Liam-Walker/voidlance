import Phaser from 'phaser';
import { services } from '../services';
import { Starfield } from '../core/Starfield';
import { hexToNum } from '../util/color';

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
    new Starfield(this, theme);

    this.add.text(W / 2, H * 0.26, 'RUN OVER', { fontFamily: 'monospace', fontSize: '58px', color: p.danger }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.26 + 50, theme.name, { fontFamily: 'monospace', fontSize: '24px', color: p.accent })
      .setOrigin(0.5)
      .setAlpha(0.85);

    const lines = [`SCORE   ${data.score}`, data.isBest ? '*** NEW BEST ***' : `BEST    ${data.best}`, `COINS  +${data.coins}`];
    this.add
      .text(W / 2, H * 0.46, lines.join('\n'), { fontFamily: 'monospace', fontSize: '30px', color: p.text, align: 'center' })
      .setOrigin(0.5)
      .setLineSpacing(14);

    this.button(W / 2, H * 0.66, 'RETRY', p.accent, p.bg, () => this.scene.start('Game'));
    this.button(W / 2, H * 0.66 + 80, 'HANGAR', p.text, p.bgAccent, () => this.scene.start('Menu'));
  }

  private button(x: number, y: number, label: string, fg: string, bg: string, onClick: () => void): void {
    const rect = this.add
      .rectangle(x, y, 260, 60, hexToNum(bg))
      .setStrokeStyle(2, hexToNum(fg))
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontFamily: 'monospace', fontSize: '26px', color: fg }).setOrigin(0.5);
    rect.on('pointerover', () => rect.setFillStyle(hexToNum(fg), 0.18));
    rect.on('pointerout', () => rect.setFillStyle(hexToNum(bg)));
    rect.on('pointerup', onClick);
  }
}

import Phaser from 'phaser';
import { services } from '../services';
import { label, glow } from '../core/ui';
import { hexToNum, lighten, darken } from '../util/color';

// Framed arcade HUD: top bar with SCORE, level banner, combo, coins, and lives
// drawn as ship icons. Reads gameplay state from the shared game registry.
export class HudScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private coinsText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private lives: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Hud');
  }

  create(): void {
    const theme = services().themes.active;
    const p = theme.palette;
    const W = this.scale.width;
    this.lives = [];

    const bar = this.add.graphics();
    bar.fillStyle(hexToNum(darken(p.bg, 0.4)), 0.62);
    bar.fillRect(0, 0, W, 78);
    bar.lineStyle(2, hexToNum(p.accent), 0.5);
    bar.lineBetween(0, 78, W, 78);

    label(this, 22, 18, 'SCORE', 13, p.text, { originX: 0, weight: '600' }).setAlpha(0.6);
    this.scoreText = label(this, 22, 46, '000000', 30, lighten(p.text, 0.1), { originX: 0, weight: '700', display: true });

    this.add.image(W - 152, 30, 'coin').setTint(0xffd23f).setScale(0.72);
    this.coinsText = label(this, W - 134, 30, '0', 25, '#ffe27a', { originX: 0, weight: '700', display: true });

    this.levelText = label(this, W / 2, 22, '', 20, lighten(p.text, 0.05), { weight: '600' }).setAlpha(0.85);
    this.comboText = label(this, W / 2, 52, '', 23, lighten(p.accent, 0.2), { weight: '700', display: true });
    glow(this.comboText, hexToNum(p.accent), 3, 8);

    const lifeKey = theme.player.shape === 'wasp' ? 'ship-wasp' : 'ship-arrow';
    const lifeTint = hexToNum(theme.player.tint);
    const maxHp = (this.registry.get('maxHp') as number) ?? 3;
    for (let i = 0; i < maxHp; i++) {
      this.lives.push(
        this.add.image(W - 26 - i * 30, 62, lifeKey).setTint(lifeTint).setScale(0.4)
      );
    }

    const reg = this.registry;
    const handler = (): void => this.refresh(reg);
    handler();
    reg.events.on('changedata', handler);
    this.events.once('shutdown', () => reg.events.off('changedata', handler));
  }

  private refresh(reg: Phaser.Data.DataManager): void {
    const num = (k: string): number => (reg.get(k) as number) ?? 0;
    this.scoreText.setText(`${num('score')}`.padStart(6, '0'));
    this.coinsText.setText(`${num('coins')}`);
    this.levelText.setText((reg.get('levelName') as string) ?? '');
    const combo = num('combo');
    this.comboText.setText(combo > 1 ? `COMBO x${combo}` : '');
    const hp = num('hp');
    for (let i = 0; i < this.lives.length; i++) this.lives[i].setAlpha(i < hp ? 1 : 0.16);
  }
}

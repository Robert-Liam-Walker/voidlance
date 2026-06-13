import Phaser from 'phaser';
import { services } from '../services';

// Overlay scene (lives above GameScene so camera shake doesn't move the UI).
// Reads gameplay state from the shared game registry.
export class HudScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private coinsText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;

  constructor() {
    super('Hud');
  }

  create(): void {
    const p = services().themes.active.palette;
    const W = this.scale.width;
    const mk = (x: number, y: number, originX: number, size: number, color: string): Phaser.GameObjects.Text =>
      this.add.text(x, y, '', { fontFamily: 'monospace', fontSize: `${size}px`, color }).setOrigin(originX, 0);

    this.scoreText = mk(20, 18, 0, 26, p.text);
    this.coinsText = mk(W - 20, 18, 1, 24, p.accent);
    this.levelText = mk(W / 2, 18, 0.5, 20, p.text).setAlpha(0.8);
    this.hpText = mk(20, 52, 0, 24, p.danger);
    this.comboText = mk(W / 2, 50, 0.5, 24, p.accent);

    const reg = this.registry;
    const handler = (): void => this.refresh(reg);
    handler();
    reg.events.on('changedata', handler);
    this.events.once('shutdown', () => reg.events.off('changedata', handler));
  }

  private refresh(reg: Phaser.Data.DataManager): void {
    const num = (k: string): number => (reg.get(k) as number) ?? 0;
    const hp = num('hp');
    const maxHp = num('maxHp');
    const combo = num('combo');
    this.scoreText.setText(`${num('score')}`.padStart(6, '0'));
    this.coinsText.setText(`> ${num('coins')}`);
    this.levelText.setText((reg.get('levelName') as string) ?? '');
    this.hpText.setText('#'.repeat(Math.max(0, hp)) + '.'.repeat(Math.max(0, maxHp - hp)));
    this.comboText.setText(combo > 1 ? `x${combo}` : '');
  }
}

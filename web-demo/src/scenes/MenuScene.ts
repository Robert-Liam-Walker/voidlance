import Phaser from 'phaser';
import { services } from '../services';
import { Starfield } from '../core/Starfield';
import { hexToNum } from '../util/color';
import type { ThemeDef, ThemePalette } from '../data/types';

// Title + theme portals (the Nova Lance <-> Void Hornet switch) + coins,
// the one-upgrade Hangar panel, and Launch. Rebuilds via scene.restart().
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const s = services();
    const theme = s.themes.active;
    const p = theme.palette;
    const W = this.scale.width;
    const H = this.scale.height;

    new Starfield(this, theme);

    this.add.text(W / 2, H * 0.15, 'VOIDLANCE', { fontFamily: 'monospace', fontSize: '66px', color: p.accent }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.15 + 54, theme.tagline, { fontFamily: 'monospace', fontSize: '22px', color: p.text })
      .setOrigin(0.5)
      .setAlpha(0.85);

    const themes = s.themes.list().slice(0, 2);
    const gap = 250;
    themes.forEach((t, i) => this.portal(W / 2 + (i === 0 ? -gap / 2 : gap / 2), H * 0.34, t, t.id === theme.id));

    this.add
      .text(W / 2, H * 0.5, `> ${s.economy.coins(theme.id)}    BEST ${s.economy.bestScore(theme.id)}`, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: p.accent,
      })
      .setOrigin(0.5);

    this.upgradePanel(W / 2, H * 0.6, theme);
    this.launchButton(W / 2, H * 0.81, p);

    this.add
      .text(W / 2, H * 0.9, 'drag to move  -  auto-fire', { fontFamily: 'monospace', fontSize: '18px', color: p.text })
      .setOrigin(0.5)
      .setAlpha(0.5);
  }

  private portal(x: number, y: number, t: ThemeDef, selected: boolean): void {
    const p = t.palette;
    const rect = this.add
      .rectangle(x, y, 210, 124, hexToNum(p.bg))
      .setStrokeStyle(selected ? 4 : 2, hexToNum(p.accent))
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y - 38, t.name, { fontFamily: 'monospace', fontSize: '24px', color: p.accent }).setOrigin(0.5);
    this.add
      .image(x, y + 8, t.player.shape === 'wasp' ? 'ship-wasp' : 'ship-arrow')
      .setTint(hexToNum(t.player.tint))
      .setScale(0.85);
    this.add
      .text(x, y + 44, selected ? 'ACTIVE' : 'tap to switch', { fontFamily: 'monospace', fontSize: '14px', color: p.text })
      .setOrigin(0.5)
      .setAlpha(0.7);
    rect.on('pointerup', () => {
      services().themes.setActive(t.id);
      this.scene.restart();
    });
  }

  private upgradePanel(x: number, y: number, theme: ThemeDef): void {
    const s = services();
    const p = theme.palette;
    const upg = s.economy.upgrades()[0];
    const lvl = s.economy.level(theme.id, upg.id);
    const maxed = s.economy.isMaxed(theme.id, upg);
    const canBuy = s.economy.canBuy(theme.id, upg);

    this.add
      .text(x - 150, y, `${upg.name}  Lv ${lvl}/${upg.maxLevel}`, { fontFamily: 'monospace', fontSize: '20px', color: p.text })
      .setOrigin(0, 0.5);

    const label = maxed ? 'MAX' : `BUY >${s.economy.cost(theme.id, upg)}`;
    const tone = canBuy ? p.accent : p.text;
    const btn = this.add
      .rectangle(x + 150, y, 156, 42, hexToNum(canBuy ? p.accent : p.bgAccent), canBuy ? 0.2 : 0.12)
      .setStrokeStyle(2, hexToNum(tone))
      .setInteractive({ useHandCursor: !maxed });
    this.add.text(x + 150, y, label, { fontFamily: 'monospace', fontSize: '18px', color: tone }).setOrigin(0.5);

    if (!maxed) {
      btn.on('pointerup', () => {
        if (s.economy.buy(theme.id, upg)) this.scene.restart();
      });
    }
  }

  private launchButton(x: number, y: number, p: ThemePalette): void {
    const c = this.add.container(x, y);
    const rect = this.add
      .rectangle(0, 0, 300, 74, hexToNum(p.accent), 0.16)
      .setStrokeStyle(3, hexToNum(p.accent))
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(0, 0, 'LAUNCH', { fontFamily: 'monospace', fontSize: '36px', color: p.accent }).setOrigin(0.5);
    rect.on('pointerover', () => rect.setFillStyle(hexToNum(p.accent), 0.3));
    rect.on('pointerout', () => rect.setFillStyle(hexToNum(p.accent), 0.16));
    rect.on('pointerup', () => this.scene.start('Game'));
    c.add([rect, txt]);
    this.tweens.add({ targets: c, scale: { from: 0.98, to: 1.02 }, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });
  }
}

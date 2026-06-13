import Phaser from 'phaser';
import { services } from '../services';
import { Nebula } from '../core/Nebula';
import { panel, button, heading, label, glow } from '../core/ui';
import { hexToNum, lighten } from '../util/color';
import type { ThemeDef } from '../data/types';

// Arcade title screen: beveled glowing logo, glossy theme portals (the Nova
// Lance <-> Void Hornet switch), a coin/best chip, the Hangar upgrade panel,
// and a pulsing Launch. Rebuilds via scene.restart().
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const s = services();
    const theme = s.themes.active;
    const p = theme.palette;
    const W = this.scale.width;

    new Nebula(this, theme);

    heading(this, W / 2, 150, 'VOIDLANCE', 78, p);
    const bar = this.add.rectangle(W / 2, 202, 392, 6, hexToNum(p.accent)).setOrigin(0.5);
    glow(bar, hexToNum(p.accent), 4, 10);
    label(this, W / 2, 234, theme.tagline.toUpperCase(), 21, lighten(p.text, 0.05), { weight: '600' }).setAlpha(0.9);

    const themes = s.themes.list().slice(0, 2);
    const gap = 252;
    themes.forEach((t, i) => this.portal(W / 2 + (i === 0 ? -gap / 2 : gap / 2), 374, t, t.id === theme.id));

    const chipY = 476;
    panel(this, W / 2, chipY, 360, 54, p, { radius: 14, fillAlpha: 0.66 });
    this.add.image(W / 2 - 124, chipY, 'coin').setTint(0xffd23f).setScale(0.8);
    label(this, W / 2 - 104, chipY, `${s.economy.coins(theme.id)}`, 24, '#ffe27a', { originX: 0, weight: '700', display: true });
    label(this, W / 2 + 8, chipY, `BEST ${s.economy.bestScore(theme.id)}`, 20, lighten(p.text, 0.05), { originX: 0, weight: '600' });

    this.hangar(W / 2, 632, theme);

    const launch = button(this, W / 2, 876, 320, 80, 'LAUNCH', p, () => this.scene.start('Game'), 38);
    this.tweens.add({ targets: launch, scale: { from: 0.99, to: 1.03 }, yoyo: true, repeat: -1, duration: 950, ease: 'Sine.InOut' });

    label(this, W / 2, 986, 'DRAG TO MOVE   ·   AUTO-FIRE', 18, lighten(p.text, 0.05), { weight: '500' }).setAlpha(0.55);
  }

  private portal(x: number, y: number, t: ThemeDef, selected: boolean): void {
    const p = t.palette;
    const w = 232;
    const h = 156;
    panel(this, x, y, w, h, p, { fillAlpha: selected ? 0.86 : 0.62, borderAlpha: selected ? 1 : 0.45 });
    if (selected) {
      const g = this.add.graphics({ x, y });
      g.lineStyle(3, hexToNum(p.accent), 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
      glow(g, hexToNum(p.accent), 4, 9);
    }
    label(this, x, y - 50, t.name.toUpperCase(), 23, lighten(p.accent, 0.25), { weight: '700', display: true });
    const ship = this.add.image(x, y + 8, t.player.sprite).setScale(0.6);
    glow(ship, hexToNum(t.player.tint), 5, 10);
    label(this, x, y + 54, selected ? 'ACTIVE' : 'TAP TO SWITCH', 14, selected ? lighten(p.accent, 0.2) : p.text, { weight: '600' }).setAlpha(
      selected ? 1 : 0.6
    );
    this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      services().themes.setActive(t.id);
      this.scene.restart();
    });
  }

  private hangar(x: number, y: number, theme: ThemeDef): void {
    const s = services();
    const p = theme.palette;
    const upgrades = s.economy.upgrades();
    const rowH = 60;
    const panelH = 50 + upgrades.length * rowH;
    panel(this, x, y, 604, panelH, p, { fillAlpha: 0.72 });
    label(this, x - 276, y - panelH / 2 + 22, 'HANGAR', 16, lighten(p.accent, 0.2), { originX: 0, weight: '700', display: true }).setAlpha(0.8);

    let ry = y - panelH / 2 + 60;
    for (const upg of upgrades) {
      const lvl = s.economy.level(theme.id, upg.id);
      const maxed = s.economy.isMaxed(theme.id, upg);
      label(this, x - 276, ry - 9, upg.name, 21, lighten(p.text, 0.05), { originX: 0, weight: '700' });
      for (let i = 0; i < upg.maxLevel; i++) {
        this.add
          .rectangle(x - 276 + i * 22, ry + 15, 16, 8, hexToNum(p.accent), i < lvl ? 0.9 : 0.12)
          .setOrigin(0, 0.5)
          .setStrokeStyle(1, hexToNum(p.accent), i < lvl ? 1 : 0.4);
      }
      const txt = maxed ? 'MAX' : `> ${s.economy.cost(theme.id, upg)}`;
      button(this, x + 232, ry + 2, 116, 48, txt, p, () => {
        if (!maxed && s.economy.buy(theme.id, upg)) this.scene.restart();
      }, 18);
      ry += rowH;
    }
  }
}

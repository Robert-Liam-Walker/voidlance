import Phaser from 'phaser';
import type { ThemeDef } from '../data/types';
import { hexToNum, lighten } from '../util/color';

interface Cloud {
  spr: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  spin: number;
}

// Atmospheric, painterly space backdrop (Alien-Sky style): a deep base, drifting
// tinted nebula clouds (additive), parallax stars, an optional synth grid, and a
// cinematic vignette. Replaces the old flat starfield.
export class Nebula {
  private base: Phaser.GameObjects.Rectangle;
  private clouds: Cloud[] = [];
  private scrollers: Phaser.GameObjects.TileSprite[] = [];
  private scrollSpeeds: number[] = [];
  private vignette: Phaser.GameObjects.Image;
  private W: number;
  private H: number;

  constructor(scene: Phaser.Scene, theme: ThemeDef) {
    const W = (this.W = scene.scale.width);
    const H = (this.H = scene.scale.height);
    this.base = scene.add.rectangle(W / 2, H / 2, W, H, hexToNum(theme.palette.bg)).setDepth(-100);

    if (theme.background.style === 'grid') {
      const grid = scene.add.tileSprite(W / 2, H / 2, W, H, 'gridtile').setTint(hexToNum(theme.palette.accent)).setAlpha(0.1).setDepth(-99);
      this.scrollers.push(grid);
      this.scrollSpeeds.push(1.0);
    }

    const tints = [
      hexToNum(theme.palette.accent),
      hexToNum(theme.palette.danger),
      hexToNum(theme.palette.bgAccent),
      hexToNum(lighten(theme.palette.accent, 0.3)),
    ];
    const rng = new Phaser.Math.RandomDataGenerator([theme.id + '-nebula']);
    for (let i = 0; i < 7; i++) {
      const spr = scene.add
        .image(rng.between(0, W), rng.between(0, H), 'cloud')
        .setTint(tints[i % tints.length])
        .setAlpha(rng.realInRange(0.1, 0.22))
        .setScale(rng.realInRange(2.4, 5.5))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(-98);
      this.clouds.push({ spr, vx: rng.realInRange(-3, 3), vy: rng.realInRange(4, 12), spin: rng.realInRange(-0.02, 0.02) });
    }

    const far = scene.add.tileSprite(W / 2, H / 2, W, H, 'startile').setTint(hexToNum(theme.background.starTint)).setAlpha(0.45).setDepth(-96);
    const near = scene.add.tileSprite(W / 2, H / 2, W, H, 'startile').setTint(0xffffff).setAlpha(0.8).setTileScale(1.7).setDepth(-95);
    this.scrollers.push(far, near);
    this.scrollSpeeds.push(1.4, 3.0);

    this.vignette = scene.add.image(W / 2, H / 2, 'vignette').setDepth(-90);
  }

  update(_t: number, delta: number): void {
    const d = delta / 16.6667;
    for (const c of this.clouds) {
      c.spr.x += c.vx * d * 0.2;
      c.spr.y += c.vy * d * 0.06;
      c.spr.rotation += c.spin * d * 0.02;
      if (c.spr.y - (c.spr.displayHeight ?? 0) / 2 > this.H) {
        c.spr.y = -(c.spr.displayHeight ?? 0) / 2;
        c.spr.x = Math.random() * this.W;
      }
    }
    for (let i = 0; i < this.scrollers.length; i++) this.scrollers[i].tilePositionY -= this.scrollSpeeds[i] * d * 6;
  }

  destroy(): void {
    this.base.destroy();
    this.vignette.destroy();
    for (const c of this.clouds) c.spr.destroy();
    for (const s of this.scrollers) s.destroy();
    this.clouds = [];
    this.scrollers = [];
  }
}

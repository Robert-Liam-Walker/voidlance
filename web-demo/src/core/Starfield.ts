import Phaser from 'phaser';
import type { ThemeDef } from '../data/types';
import { hexToNum } from '../util/color';

// Parallax background. starfield = two scrolling star layers; grid = a synth
// grid layer + stars. Driven by theme.background.
export class Starfield {
  private base: Phaser.GameObjects.Rectangle;
  private layers: Phaser.GameObjects.TileSprite[] = [];
  private speeds: number[] = [];

  constructor(scene: Phaser.Scene, theme: ThemeDef) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    this.base = scene.add.rectangle(W / 2, H / 2, W, H, hexToNum(theme.palette.bg)).setDepth(-100);

    const starTint = hexToNum(theme.background.starTint);
    if (theme.background.style === 'grid') {
      const grid = scene.add
        .tileSprite(W / 2, H / 2, W, H, 'gridtile')
        .setTint(hexToNum(theme.palette.accent))
        .setAlpha(0.28)
        .setDepth(-92);
      this.add(grid, 1.1);
    }
    const far = scene.add.tileSprite(W / 2, H / 2, W, H, 'startile').setTint(starTint).setAlpha(0.5).setDepth(-95);
    const near = scene.add
      .tileSprite(W / 2, H / 2, W, H, 'startile')
      .setTint(0xffffff)
      .setAlpha(0.85)
      .setTileScale(1.7)
      .setDepth(-90);
    this.add(far, 1.6);
    this.add(near, 3.4);
  }

  private add(layer: Phaser.GameObjects.TileSprite, speed: number): void {
    this.layers.push(layer);
    this.speeds.push(speed);
  }

  update(_time: number, delta: number): void {
    const d = delta / 16.6667;
    for (let i = 0; i < this.layers.length; i++) {
      this.layers[i].tilePositionY -= this.speeds[i] * d * 6;
    }
  }

  destroy(): void {
    this.base.destroy();
    for (const l of this.layers) l.destroy();
    this.layers = [];
    this.speeds = [];
  }
}

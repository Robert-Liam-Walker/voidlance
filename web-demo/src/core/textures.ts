import Phaser from 'phaser';

// Generated FX + UI textures only (tinted at runtime) plus soft radial canvas
// textures for the nebula. Ships / enemies / lasers / power-ups use the Kenney
// CC0 sprite art loaded in BootScene.preload().
export function buildTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const C = 0xffffff;
  const make = (key: string, w: number, h: number, draw: () => void): void => {
    g.clear();
    draw();
    g.generateTexture(key, w, h);
  };

  make('particle', 8, 8, () => {
    g.fillStyle(C, 1);
    g.fillCircle(4, 4, 4);
  });
  make('star', 4, 4, () => {
    g.fillStyle(C, 1);
    g.fillRect(0, 0, 4, 4);
  });
  make('coin', 28, 28, () => {
    g.lineStyle(3, C, 1);
    g.strokeCircle(14, 14, 11);
    g.fillStyle(C, 1);
    g.fillCircle(14, 14, 4.5);
  });
  make('barrier', 54, 34, () => {
    g.fillStyle(C, 1);
    g.fillRoundedRect(0, 0, 54, 34, 7);
  });
  make('bomb', 26, 26, () => {
    g.fillStyle(C, 1);
    g.fillCircle(13, 13, 11);
  });
  make('bot', 18, 18, () => {
    g.lineStyle(3, C, 1);
    g.strokeCircle(9, 9, 6);
    g.fillStyle(C, 1);
    g.fillCircle(9, 9, 2.5);
  });
  make('missile', 12, 22, () => {
    g.fillStyle(C, 1);
    g.fillPoints([{ x: 6, y: 0 }, { x: 12, y: 14 }, { x: 9, y: 22 }, { x: 3, y: 22 }, { x: 0, y: 14 }], true);
  });
  make('startile', 128, 128, () => {
    const rng = new Phaser.Math.RandomDataGenerator(['voidlance-stars']);
    for (let i = 0; i < 28; i++) {
      g.fillStyle(C, rng.realInRange(0.25, 0.95));
      g.fillCircle(rng.between(2, 126), rng.between(2, 126), rng.realInRange(0.6, 1.9));
    }
  });
  make('gridtile', 128, 128, () => {
    g.lineStyle(1, C, 0.6);
    for (let x = 0; x <= 128; x += 32) g.lineBetween(x, 0, x, 128);
    for (let y = 0; y <= 128; y += 32) g.lineBetween(0, y, 128, y);
  });

  const radial = (key: string, size: number, stops: [number, string][]): void => {
    const tex = scene.textures.createCanvas(key, size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) grd.addColorStop(o, col);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  };
  radial('cloud', 256, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
  radial('glow', 128, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);

  const vig = scene.textures.createCanvas('vignette', 720, 1280);
  if (vig) {
    const ctx = vig.getContext();
    const grd = ctx.createRadialGradient(360, 600, 240, 360, 720, 840);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 720, 1280);
    vig.refresh();
  }

  g.destroy();
}

import Phaser from 'phaser';

// All sprites are generated as WHITE vector shapes and re-tinted per theme at
// runtime (one texture set, recoloured for both Nova Lance and Void Hornet).
// Kenney CC0 art replaces these in Phase 4.
export function buildTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const C = 0xffffff;
  const make = (key: string, w: number, h: number, draw: () => void): void => {
    g.clear();
    draw();
    g.generateTexture(key, w, h);
  };

  make('ship-arrow', 54, 60, () => {
    g.fillStyle(C, 1);
    g.fillPoints([{ x: 27, y: 0 }, { x: 52, y: 58 }, { x: 27, y: 44 }, { x: 2, y: 58 }], true);
  });
  make('ship-wasp', 54, 60, () => {
    g.fillStyle(C, 1);
    g.fillEllipse(27, 30, 22, 48);
    g.fillTriangle(6, 16, 26, 30, 8, 46);
    g.fillTriangle(48, 16, 28, 30, 46, 46);
    g.fillTriangle(22, 54, 32, 54, 27, 60);
  });
  make('enemy-drone', 48, 44, () => {
    g.fillStyle(C, 1);
    g.fillPoints([{ x: 4, y: 20 }, { x: 44, y: 20 }, { x: 34, y: 40 }, { x: 14, y: 40 }], true);
    g.fillEllipse(24, 16, 28, 18);
  });
  make('enemy-bug', 48, 44, () => {
    g.fillStyle(C, 1);
    g.fillEllipse(24, 24, 32, 26);
    g.fillTriangle(9, 16, 1, 10, 12, 20);
    g.fillTriangle(7, 24, 0, 25, 11, 26);
    g.fillTriangle(9, 32, 1, 38, 12, 28);
    g.fillTriangle(39, 16, 47, 10, 36, 20);
    g.fillTriangle(41, 24, 48, 25, 37, 26);
    g.fillTriangle(39, 32, 47, 38, 36, 28);
    g.fillTriangle(18, 6, 15, 0, 22, 9);
    g.fillTriangle(30, 6, 33, 0, 26, 9);
  });
  make('enemy-wing', 48, 44, () => {
    g.fillStyle(C, 1);
    g.fillPoints([{ x: 24, y: 6 }, { x: 46, y: 34 }, { x: 24, y: 26 }, { x: 2, y: 34 }], true);
  });
  make('enemy-diamond', 48, 48, () => {
    g.fillStyle(C, 1);
    g.fillPoints([{ x: 24, y: 3 }, { x: 45, y: 24 }, { x: 24, y: 45 }, { x: 3, y: 24 }], true);
  });
  make('bullet', 8, 22, () => {
    g.fillStyle(C, 1);
    g.fillRoundedRect(0, 0, 8, 22, 3);
  });
  make('enemy-bullet', 12, 12, () => {
    g.fillStyle(C, 1);
    g.fillCircle(6, 6, 6);
  });
  make('particle', 8, 8, () => {
    g.fillStyle(C, 1);
    g.fillCircle(4, 4, 4);
  });
  make('star', 4, 4, () => {
    g.fillStyle(C, 1);
    g.fillRect(0, 0, 4, 4);
  });
  make('powerup', 30, 30, () => {
    g.fillStyle(C, 1);
    g.fillCircle(15, 15, 13);
  });

  const rng = new Phaser.Math.RandomDataGenerator(['voidlance-stars']);
  make('startile', 128, 128, () => {
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

  g.destroy();
}

import Phaser from 'phaser';

// Game feel: particle bursts, screen shake, floating score pops.
export function burst(scene: Phaser.Scene, x: number, y: number, tint: number, count = 14): void {
  const e = scene.add.particles(x, y, 'particle', {
    speed: { min: 70, max: 230 },
    angle: { min: 0, max: 360 },
    lifespan: { min: 240, max: 480 },
    scale: { start: 1.1, end: 0 },
    quantity: 0,
    blendMode: 'ADD',
    tint,
  });
  e.setDepth(20);
  e.explode(count, x, y);
  scene.time.delayedCall(520, () => e.destroy());
}

export function shake(scene: Phaser.Scene, intensity = 0.006, duration = 140): void {
  scene.cameras.main.shake(duration, intensity);
}

export function popText(scene: Phaser.Scene, x: number, y: number, text: string, color: string): void {
  const t = scene.add
    .text(x, y, text, { fontFamily: 'monospace', fontSize: '20px', color })
    .setOrigin(0.5)
    .setDepth(30);
  scene.tweens.add({
    targets: t,
    y: y - 46,
    alpha: 0,
    duration: 620,
    ease: 'Cubic.Out',
    onComplete: () => t.destroy(),
  });
}

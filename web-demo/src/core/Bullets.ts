import Phaser from 'phaser';

// Pooled projectiles (the per-frame hot path). One pool for player shots, one
// for enemy shots. Recycled when they leave the screen.
export class Bullets {
  group: Phaser.Physics.Arcade.Group;
  private W: number;
  private H: number;

  constructor(scene: Phaser.Scene, private textureKey: string, maxSize = 256) {
    this.group = scene.physics.add.group({ defaultKey: textureKey, maxSize });
    this.W = scene.scale.width;
    this.H = scene.scale.height;
  }

  fire(x: number, y: number, vx: number, vy: number, tint: number, scale = 1): Phaser.Physics.Arcade.Sprite | null {
    const b = this.group.get(x, y, this.textureKey) as Phaser.Physics.Arcade.Sprite | null;
    if (!b) return null;
    b.setActive(true).setVisible(true).setTint(tint).setScale(scale);
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.reset(x, y);
    body.enable = true;
    b.setVelocity(vx, vy);
    b.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
    return b;
  }

  recycle(): void {
    const m = 60;
    for (const obj of this.group.getChildren()) {
      const b = obj as Phaser.Physics.Arcade.Sprite;
      if (!b.active) continue;
      if (b.y < -m || b.y > this.H + m || b.x < -m || b.x > this.W + m) this.kill(b);
    }
  }

  kill(b: Phaser.Physics.Arcade.Sprite): void {
    b.setActive(false).setVisible(false);
    const body = b.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.stop();
      body.enable = false;
    }
  }
}

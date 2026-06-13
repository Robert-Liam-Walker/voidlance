import Phaser from 'phaser';
import type { EnemyDef } from '../data/types';

export type EnemyMode = 'enter' | 'formation' | 'dive' | 'return' | 'active';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  def: EnemyDef;
  hp: number;
  mode: EnemyMode = 'enter';
  slotX = 0;
  slotY = 0;
  row = 0;
  col = 0;
  fireCd = 0;
  actCd = 0;
  dir = 1;
  phase = 0;
  didAct = false;
  diveTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, texKey: string, hp: number) {
    super(scene, x, y, texKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.def = def;
    this.hp = hp;
    this.setScale(def.size / this.width);
    this.setDepth(8);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.width * 0.7, this.height * 0.7, true);
    this.fireCd = Phaser.Math.Between(900, 2800);
    this.actCd = Phaser.Math.Between(1400, 2800);
  }
}

// DOM pointer + keyboard input (replaces Phaser input). Reports the pointer as
// NDC (-1..1) so the renderer can raycast it onto the playfield; keyboard is
// reported as a -1..1 direction vector.
export class Input {
  pointer = { ndcX: 0, ndcY: 0, active: false, down: false };
  private keys = new Set<string>();
  private isTouch = false;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  private setNdc(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.ndcX = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.ndcY = -(((e.clientY - r.top) / r.height) * 2 - 1);
  }

  private onMove = (e: PointerEvent): void => {
    this.setNdc(e);
    if (e.pointerType === 'touch') {
      this.isTouch = true;
      this.pointer.active = this.pointer.down;
    } else {
      this.pointer.active = true;
    }
  };

  private onDown = (e: PointerEvent): void => {
    this.setNdc(e);
    this.pointer.down = true;
    this.pointer.active = true;
    if (e.pointerType === 'touch') this.isTouch = true;
  };

  private onUp = (): void => {
    this.pointer.down = false;
    if (this.isTouch) this.pointer.active = false;
  };

  keyVector(): { x: number; y: number } {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.has('arrowleft') || k.has('a')) x -= 1;
    if (k.has('arrowright') || k.has('d')) x += 1;
    if (k.has('arrowup') || k.has('w')) y -= 1;
    if (k.has('arrowdown') || k.has('s')) y += 1;
    return { x, y };
  }
}

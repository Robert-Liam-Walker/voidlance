import Phaser from 'phaser';
import type { ThemePalette } from '../data/types';
import { hexToNum, lighten, darken } from '../util/color';

// Arcade UI kit: bold sci-fi type, beveled glowing headings, glossy framed
// panels + buttons. Targets the polished arcade look of Alien Sky.
export const FONT = { display: 'Orbitron, sans-serif', body: 'Rajdhani, sans-serif' };

/** Soft outer glow (WebGL preFX only; safe no-op on the Canvas fallback). */
export function glow(obj: Phaser.GameObjects.GameObject, color: number, outer = 4, distance = 10): void {
  const pfx = (obj as unknown as { preFX?: { addGlow?: (...a: unknown[]) => unknown } }).preFX;
  if (pfx && typeof pfx.addGlow === 'function') pfx.addGlow(color, outer, 0, false, 0.1, distance);
}

/** Big beveled, glowing title text. */
export function heading(scene: Phaser.Scene, x: number, y: number, text: string, sizePx: number, p: ThemePalette): Phaser.GameObjects.Text {
  const t = scene.add
    .text(x, y, text, {
      fontFamily: FONT.display,
      fontStyle: '900',
      fontSize: `${sizePx}px`,
      color: lighten(p.accent, 0.55),
      stroke: darken(p.accent, 0.35),
      strokeThickness: Math.max(3, Math.round(sizePx * 0.07)),
    })
    .setOrigin(0.5);
  t.setShadow(0, Math.round(sizePx * 0.08), '#000000', sizePx * 0.18, true, true);
  glow(t, hexToNum(p.accent), 5, 14);
  return t;
}

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  sizePx: number,
  color: string,
  opts?: { originX?: number; weight?: string; display?: boolean }
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: opts?.display ? FONT.display : FONT.body,
      fontStyle: opts?.weight ?? '600',
      fontSize: `${sizePx}px`,
      color,
    })
    .setOrigin(opts?.originX ?? 0.5, 0.5);
}

/** Glossy framed glass panel (returned Graphics is positioned at x,y). */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  p: ThemePalette,
  opts?: { radius?: number; fillAlpha?: number; borderAlpha?: number }
): Phaser.GameObjects.Graphics {
  const r = opts?.radius ?? 16;
  const g = scene.add.graphics({ x, y });
  g.fillStyle(hexToNum(darken(p.bg, 0.35)), opts?.fillAlpha ?? 0.8);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.fillStyle(hexToNum(lighten(p.bg, 0.14)), 0.18);
  g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.4, r - 4);
  g.lineStyle(2, hexToNum(p.accent), opts?.borderAlpha ?? 0.85);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  return g;
}

/** Glossy beveled button with hover/press feedback + glow. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  p: ThemePalette,
  onClick: () => void,
  fontSize = 28
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const r = 14;
  const redraw = (hover: boolean): void => {
    g.clear();
    g.fillStyle(hexToNum(darken(p.bg, 0.15)), 0.72);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.fillStyle(hexToNum(p.accent), hover ? 0.34 : 0.18);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.fillStyle(hexToNum(lighten(p.accent, 0.5)), hover ? 0.22 : 0.12);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.46, r - 4);
    g.lineStyle(2, hexToNum(p.accent), hover ? 1 : 0.85);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  };
  redraw(false);
  const txt = scene.add
    .text(0, 0, text, { fontFamily: FONT.display, fontStyle: '700', fontSize: `${fontSize}px`, color: lighten(p.accent, 0.2) })
    .setOrigin(0.5);
  glow(txt, hexToNum(p.accent), 3, 9);
  const hit = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
  hit.on('pointerover', () => redraw(true));
  hit.on('pointerout', () => {
    redraw(false);
    c.setScale(1);
  });
  hit.on('pointerdown', () => c.setScale(0.97));
  hit.on('pointerup', () => {
    c.setScale(1);
    onClick();
  });
  c.add([g, txt, hit]);
  return c;
}

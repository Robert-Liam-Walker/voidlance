import * as THREE from 'three';
import type { FxEvent } from '../world/types';
import { worldX, worldZ, HOVER_Y } from '../config';

const css = (hex: number): string => '#' + hex.toString(16).padStart(6, '0');

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number; // base radius multiplier
  drag: number; // velocity damping per second (sparks streak then halt)
  spark: boolean; // sparks stretch along travel and fade hot->color
  expand: boolean; // flash core: balloons in place, no gravity
  hot: number; // white-hot tint color (lerp target while bright)
  base: number; // settled color
}
interface Ring {
  mesh: THREE.Mesh;
  life: number;
  max: number;
}
interface Beam {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  baseOp: number;
}
interface Pop {
  el: HTMLElement;
  x: number;
  y: number;
  life: number;
}

// 3D + DOM game-feel layer: particle bursts, expanding ground rings, vertical
// beams, camera shake, full-screen flash, and floating score pops. Mirrors the
// original Phaser Juice/camera FX in the new renderer.
export class FxLayer {
  private particles: Particle[] = [];
  private freeParticles: Particle[] = [];
  private rings: Ring[] = [];
  private beams: Beam[] = [];
  private pops: Pop[] = [];
  private shakeMag = 0;
  private shakeLeft = 0;
  private shakeDur = 1;
  private flashEl: HTMLElement;

  constructor(private scene: THREE.Scene, private camera: THREE.Camera, private canvas: HTMLCanvasElement, private overlay: HTMLElement) {
    const geo = new THREE.SphereGeometry(0.45, 6, 6);
    for (let i = 0; i < 256; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.freeParticles.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, drag: 0, spark: false, expand: false, hot: 0xffffff, base: 0xffffff });
    }
    this.flashEl = document.createElement('div');
    Object.assign(this.flashEl.style, {
      position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0', mixBlendMode: 'screen',
    } as Partial<CSSStyleDeclaration>);
    overlay.appendChild(this.flashEl);
  }

  handle(ev: FxEvent): void {
    switch (ev.type) {
      case 'burst': this.burst(ev.x, ev.y, ev.color, ev.count); break;
      case 'shake': this.shakeMag = Math.max(this.shakeMag, ev.intensity * 60); this.shakeLeft = Math.max(this.shakeLeft, ev.durMs); this.shakeDur = Math.max(this.shakeDur, this.shakeLeft); break;
      case 'flash': this.flash(ev.color, ev.durMs); break;
      case 'pop': this.pop(ev.x, ev.y, ev.text, ev.color); break;
      case 'ring': this.ring(ev.x, ev.y, ev.color, ev.radius); break;
      case 'beam': this.beam(ev.x, ev.y0, ev.y1, ev.color, ev.width, ev.durMs); break;
    }
  }

  private burst(x: number, y: number, color: number, count: number): void {
    const wx = worldX(x);
    const wz = worldZ(y);
    const hot = HOT.copy(WHITE).lerp(TMPCOL.setHex(color), 0.25).getHex(); // white-hot tint
    const big = count >= 10; // enemy death vs. small impact/muzzle puff

    // Roughly half hot sparks (fast, thin, streaking), half chunkier debris.
    for (let i = 0; i < count; i++) {
      const p = this.freeParticles.pop();
      if (!p) break;
      const spark = i % 2 === 0;
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 1;
      p.mesh.position.set(wx, HOVER_Y, wz);
      p.mesh.rotation.set(0, 0, 0);
      p.mesh.visible = true;

      const a = Math.random() * Math.PI * 2;
      const el = Math.random() * Math.PI - Math.PI / 2;
      const cel = Math.cos(el);
      p.spark = spark;
      p.expand = false;
      p.hot = hot;
      p.base = color;
      if (spark) {
        const sp = 10 + Math.random() * 18;
        p.vx = Math.cos(a) * cel * sp;
        p.vz = Math.sin(a) * cel * sp;
        p.vy = Math.sin(el) * sp * 0.4 + 1.5;
        p.size = 0.35 + Math.random() * 0.35;
        p.drag = 6;
        p.max = 0.18 + Math.random() * 0.22;
        mat.color.setHex(hot);
      } else {
        const sp = 4 + Math.random() * 9;
        p.vx = Math.cos(a) * cel * sp;
        p.vz = Math.sin(a) * cel * sp;
        p.vy = Math.sin(el) * sp * 0.6 + 2.5;
        p.size = 0.7 + Math.random() * 0.7;
        p.drag = 1.4;
        p.max = 0.3 + Math.random() * 0.35;
        mat.color.setHex(color);
      }
      p.mesh.scale.setScalar(p.size);
      p.life = p.max;
      this.particles.push(p);
    }

    // A brief white-hot flash core that balloons and vanishes — the "pop".
    const core = this.freeParticles.pop();
    if (core) {
      const mat = core.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(hot);
      mat.opacity = 1;
      core.mesh.position.set(wx, HOVER_Y, wz);
      core.mesh.rotation.set(0, 0, 0);
      core.mesh.visible = true;
      core.vx = core.vy = core.vz = 0;
      core.spark = false;
      core.expand = true;
      core.drag = 0;
      core.hot = hot;
      core.base = hot;
      core.size = big ? 5 : 2.2;
      core.mesh.scale.setScalar(core.size * 0.4);
      core.max = big ? 0.16 : 0.1;
      core.life = core.max;
      this.particles.push(core);
    }
  }

  private ring(x: number, y: number, color: number, radius: number): void {
    const r = radius * 0.1;
    // Thicker leading edge so the shockwave reads as a band, not a hairline.
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.72, r, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(worldX(x), HOVER_Y - 1.4, worldZ(y));
    mesh.scale.setScalar(0.12);
    this.scene.add(mesh);
    this.rings.push({ mesh, life: 0.42, max: 0.42 });
  }

  private beam(x: number, y0: number, y1: number, color: number, width: number, durMs: number): void {
    const len = (y1 - y0) * 0.1;
    const wide = width > 10;
    // Wide beams (charge/boss lasers) glow white-hot at the core; thin beams
    // (tracers/aim lines) stay tinted and faint.
    const col = wide ? TMPCOL.setHex(color).lerp(WHITE, 0.4).getHex() : color;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.1, 3, Math.max(0.1, len)),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: wide ? 0.85 : 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    mesh.position.set(worldX(x), HOVER_Y, worldZ((y0 + y1) / 2));
    this.scene.add(mesh);
    this.beams.push({ mesh, life: durMs / 1000, max: durMs / 1000, baseOp: wide ? 0.85 : 0.3 });
  }

  private flash(color: number, durMs: number): void {
    this.flashEl.style.background = css(color);
    this.flashEl.style.opacity = '0.55';
    this.flashEl.style.transition = `opacity ${durMs}ms ease-out`;
    requestAnimationFrame(() => (this.flashEl.style.opacity = '0'));
  }

  private pop(x: number, y: number, text: string, color: number): void {
    const v = new THREE.Vector3(worldX(x), HOVER_Y + 2, worldZ(y)).project(this.camera);
    const cr = this.canvas.getBoundingClientRect();
    const or = this.overlay.getBoundingClientRect();
    const px = cr.left - or.left + ((v.x + 1) / 2) * cr.width;
    const py = cr.top - or.top + ((1 - v.y) / 2) * cr.height;
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, {
      position: 'absolute', left: `${px}px`, top: `${py}px`, transform: 'translate(-50%,-50%)',
      color: css(color), font: "700 20px 'Rajdhani', sans-serif", textShadow: `0 0 8px ${css(color)}`,
      pointerEvents: 'none', willChange: 'transform, opacity',
    } as Partial<CSSStyleDeclaration>);
    this.overlay.appendChild(el);
    this.pops.push({ el, x: px, y: py, life: 0.62 });
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        p.mesh.scale.setScalar(1);
        p.mesh.rotation.set(0, 0, 0);
        this.particles.splice(i, 1);
        this.freeParticles.push(p);
        continue;
      }
      const k = p.life / p.max; // 1 -> 0
      const mat = p.mesh.material as THREE.MeshBasicMaterial;

      if (p.expand) {
        // Flash core: balloon outward, fade fast (ease-out), stay put.
        const e = 1 - k * k;
        p.mesh.scale.setScalar(p.size * (0.4 + e * 0.9));
        mat.opacity = k * k;
        continue;
      }

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      // velocity damping (sparks streak then stall) + gravity on debris
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vz *= damp;
      p.vy = p.vy * damp - (p.spark ? 4 : 11) * dt;

      mat.opacity = k;
      if (p.spark) {
        // Stretch along travel and cool from white-hot to the base color.
        const sp = Math.hypot(p.vx, p.vy, p.vz);
        const stretch = 1 + Math.min(2.5, sp * 0.06);
        p.mesh.scale.set(p.size * 0.5, p.size * 0.5, p.size * stretch);
        p.mesh.lookAt(p.mesh.position.x + p.vx, p.mesh.position.y + p.vy, p.mesh.position.z + p.vz);
        mat.color.copy(TMPCOL.setHex(p.base)).lerp(TMPCOL2.setHex(p.hot), Math.min(1, k * 1.4));
      } else {
        p.mesh.scale.setScalar(p.size * (0.4 + k));
      }
    }
    // rings (expanding shockwave: fast ease-out growth, fade as it widens)
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const k = 1 - r.life / r.max; // 0 -> 1
      const ease = 1 - (1 - k) * (1 - k); // ease-out
      r.mesh.scale.setScalar(0.12 + ease * 26);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - k) * (1 - k));
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
      }
    }
    // beams (hold bright, then fade out + thin over the last of their life)
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      const k = Math.max(0, b.life / b.max); // 1 -> 0
      const fade = k > 0.6 ? 1 : k / 0.6; // hold full, then ramp down
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = b.baseOp * fade;
      b.mesh.scale.x = 0.4 + fade * 0.6; // pinch as it dies
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.beams.splice(i, 1);
      }
    }
    // pops
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.el.remove();
        this.pops.splice(i, 1);
        continue;
      }
      const prog = 1 - p.life / 0.62;
      p.el.style.transform = `translate(-50%, calc(-50% - ${prog * 46}px))`;
      p.el.style.opacity = `${1 - prog}`;
    }
    // shake timer
    if (this.shakeLeft > 0) this.shakeLeft -= dtMs;
    else { this.shakeMag = 0; this.shakeDur = 1; }
  }

  /** Camera positional jitter to add this frame. Magnitude eases out over the
   *  shake's lifetime (quadratic) so a hit snaps hard then settles smoothly. */
  shakeOffset(): THREE.Vector3 {
    if (this.shakeMag <= 0 || this.shakeLeft <= 0) return ZERO;
    const t = this.shakeLeft / this.shakeDur; // 1 -> 0
    const m = this.shakeMag * t * t;
    return new THREE.Vector3((Math.random() - 0.5) * m, (Math.random() - 0.5) * m * 0.4, (Math.random() - 0.5) * m);
  }
}

const ZERO = new THREE.Vector3();
const WHITE = new THREE.Color(0xffffff);
const HOT = new THREE.Color();
const TMPCOL = new THREE.Color();
const TMPCOL2 = new THREE.Color();

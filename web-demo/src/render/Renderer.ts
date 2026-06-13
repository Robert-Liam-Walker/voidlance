import * as THREE from 'three';
import type { ThemeDef } from '../data/types';
import type { World } from '../world/World';
import type { Entity } from '../world/types';
import { worldX, worldZ, logicalX, logicalY, HOVER_Y, BANK_K, BANK_MAX, BANK_LAMBDA } from '../config';
import { createMesh, disposeObject } from './meshes';
import { FxLayer } from './fx';
import { clamp, damp } from '../app/mathx';

// Three.js render layer. Owns the scene/camera/lights and the tilted top-down
// view that makes the 2D-bounded playfield read as 3D. Reads the sim each frame
// and positions one mesh per entity; never owns game logic.
export class Renderer {
  readonly domElement: HTMLCanvasElement;
  readonly overlay: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private camBase = new THREE.Vector3(0, 95, 90);
  private meshes = new Map<number, THREE.Object3D>();
  private rolls = new Map<number, number>();
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOVER_Y);
  private stars: THREE.Points;
  private fx: FxLayer;
  private aspect = 9 / 16;

  constructor(mount: HTMLElement, theme: ThemeDef) {
    const bg = colorOf(theme.palette.bg);
    const accent = colorOf(theme.palette.accent);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(this.renderer.domElement);
    this.domElement = this.renderer.domElement;

    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' } as Partial<CSSStyleDeclaration>);
    mount.appendChild(this.overlay);

    this.scene.background = new THREE.Color(bg);
    this.scene.fog = new THREE.Fog(bg, 70, 210);

    this.camera = new THREE.PerspectiveCamera(48, this.aspect, 0.1, 1000);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, 2, -8);

    this.scene.add(new THREE.AmbientLight(0x8890b8, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(18, 60, 40);
    this.scene.add(key);
    const fill = new THREE.PointLight(accent, 1.3, 240);
    fill.position.set(0, 34, 46);
    this.scene.add(fill);

    this.stars = makeStars(colorOf(theme.background.starTint));
    this.scene.add(this.stars);

    this.fx = new FxLayer(this.scene, this.camera, this.domElement, this.overlay);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    let w = ww;
    let h = ww / this.aspect;
    if (h > wh) {
      h = wh;
      w = wh * this.aspect;
    }
    this.renderer.setSize(w, h, true);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  pointerToLogical(ndcX: number, ndcY: number): { x: number; y: number } | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, hit)) return null;
    return { x: logicalX(hit.x), y: logicalY(hit.z) };
  }

  syncWorld(world: World, dtMs: number): void {
    const dt = dtMs / 1000;
    const seen = new Set<number>();
    world.forEach((e) => {
      seen.add(e.id);
      let m = this.meshes.get(e.id);
      if (!m) {
        m = createMesh(e);
        this.scene.add(m);
        this.meshes.set(e.id, m);
        this.rolls.set(e.id, 0);
      }
      m.position.set(worldX(e.x), HOVER_Y, worldZ(e.y));
      if (e.kind === 'player' || e.kind === 'enemy') this.applyBank(e, m, dt);
      else if (m.userData.spin) m.rotation.y += dt * 2.4;
      else if (m.userData.orient) m.rotation.y = Math.atan2(e.bvx, -e.bvy);
    });
    for (const [id, m] of this.meshes) {
      if (seen.has(id)) continue;
      this.scene.remove(m);
      disposeObject(m);
      this.meshes.delete(id);
      this.rolls.delete(id);
    }

    for (const ev of world.drainFx()) this.fx.handle(ev);
  }

  /** Per-frame work that runs whether or not a run is active (bg + fx + draw). */
  frame(dtMs: number): void {
    this.scrollBackground(dtMs / 1000);
    this.fx.update(dtMs);
    this.render();
  }

  /** Drop all entity meshes (between runs / returning to menu). */
  reset(): void {
    for (const [, m] of this.meshes) {
      this.scene.remove(m);
      disposeObject(m);
    }
    this.meshes.clear();
    this.rolls.clear();
  }

  private applyBank(e: Entity, m: THREE.Object3D, dt: number): void {
    const target = clamp(-e.vx * BANK_K, -BANK_MAX, BANK_MAX);
    const roll = damp(this.rolls.get(e.id) ?? 0, target, BANK_LAMBDA, dt);
    this.rolls.set(e.id, roll);
    m.rotation.z = roll;
  }

  private scrollBackground(dt: number): void {
    const pos = this.stars.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let z = pos.getZ(i) + 30 * dt;
      if (z > 90) z -= 280;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
  }

  render(): void {
    this.camera.position.copy(this.camBase).add(this.fx.shakeOffset());
    this.renderer.render(this.scene, this.camera);
  }
}

function colorOf(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function makeStars(color: number): THREE.Points {
  const n = 280;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 200;
    arr[i * 3 + 1] = 6 + Math.random() * 40;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 280;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.7, transparent: true, opacity: 0.8 });
  return new THREE.Points(geo, mat);
}

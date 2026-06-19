import * as THREE from 'three';
import type { Entity } from '../world/types';
import { WORLD_SCALE } from '../config';
import { cloneShip } from './models';
import { laserTexture } from './textures';

const SHIP_BASE_W = 5.2; // model wing span in world units

// Procedural primitive meshes (M1/M2). Ships are built facing -Z; a `holder`
// wraps the model so the renderer can roll the holder about Z (banking) without
// disturbing facing. Wings span X so the bank reads. Kenney glTF swap = later.
export function createMesh(e: Entity): THREE.Object3D {
  switch (e.kind) {
    case 'player':
      return ship(e.color, false, e.scale, 'player');
    case 'enemy':
      return ship(e.color, true, e.scale, e.def?.behavior ?? 'fighter');
    case 'pbullet':
      return bullet(e.color, e.scale, 'player');
    case 'ebullet':
      return bullet(e.color, e.scale, 'enemy');
    case 'powerup':
      return powerup(e.color, e.scale);
    case 'barrier':
      return barrier(e.color, e.scale);
    case 'bot':
      return bot(e.color, e.scale);
    case 'missile':
      return missile(e.color, e.scale);
    case 'bomb':
      return bomb(e.color, e.scale);
    case 'boss':
      return ship(e.color, true, e.scale, 'boss');
    case 'bosspart':
      return ship(e.color, true, e.scale, 'bosspart');
  }
}

function ship(color: number, isEnemy: boolean, sizePx: number, role: string): THREE.Object3D {
  const holder = new THREE.Object3D();

  // Kenney glTF model if loaded (normalized to unit length, facing -Z); else primitive.
  const gltf = cloneShip(role);
  if (gltf) {
    if (isEnemy) gltf.rotation.y += Math.PI; // face +Z (toward player)
    holder.add(gltf);
    holder.scale.setScalar(sizePx * WORLD_SCALE);
    if (role === 'player') attachEngineTrail(holder, color);
    return holder;
  }

  const model = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.35, emissive: color, emissiveIntensity: 0.22 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.95, 3.6, 18), body);
  nose.rotation.x = -Math.PI / 2; // +Y -> -Z (forward)
  nose.position.z = -0.8;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.32, 1.7), body);
  wing.position.z = 0.7;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 1.5), body);
  tail.position.z = 1.5;
  const engine = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), glowMat);
  engine.position.z = 2.1;

  model.add(nose, wing, tail, engine);
  if (isEnemy) model.rotation.y = Math.PI; // face +Z (toward player)
  holder.add(model);
  const s = (sizePx * WORLD_SCALE) / SHIP_BASE_W;
  holder.scale.setScalar(s);
  if (role === 'player') attachEngineTrail(holder, color);
  return holder;
}

// ── Player engine trail ──────────────────────────────────────────────────────
// A short ribbon of additive glow quads that streams out behind the player and
// reacts to banking (the tail swings to the outside of a turn) and speed (the
// plume brightens/lengthens when moving). Self-animating via onBeforeRender so
// no Renderer changes are needed: it reads the holder's world matrix each render
// and lays the ribbon down in WORLD space, decoupled from the parent transform
// so it trails rather than rigidly following the ship.
const TRAIL_SEGMENTS = 14;

// One shared soft radial-glow texture for trail / engine / powerup sparkles.
// Created lazily and kept for the app lifetime (one texture total), so callers
// never dispose it — avoids per-spawn canvas/texture churn.
let _glowTex: THREE.Texture | null = null;
function glowTex(): THREE.Texture {
  if (_glowTex) return _glowTex;
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  _glowTex = new THREE.CanvasTexture(cv);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

function attachEngineTrail(holder: THREE.Object3D, color: number): void {
  // Two-tone plume: a hot white-ish core tinted by the player color, warmer at
  // the root. Built once, reused; the texture is shared across segment meshes.
  const tex = glowTex();
  const baseCol = new THREE.Color(color);
  const hot = baseCol.clone().lerp(new THREE.Color(0xffffff), 0.6);

  // Live in pure WORLD space: a probe child rides the ship to drive the trail
  // (onBeforeRender fires for objects in the scene graph), but the ribbon group
  // is reparented to the scene root on first render so the plume trails freely,
  // unaffected by the holder's scale/roll. disposeObject() walks the holder, so
  // the probe is freed; the ribbon is freed by its own dispose-on-removal hook.
  const geo = new THREE.PlaneGeometry(1, 1);
  const group = new THREE.Group();
  group.frustumCulled = false;
  const segs: THREE.Mesh[] = [];
  for (let i = 0; i < TRAIL_SEGMENTS; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: tex, color: hot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2; // lie flat on the playfield plane
    m.frustumCulled = false;
    m.visible = false;
    group.add(m);
    segs.push(m);
  }

  // The engine glow doubles as the per-frame render hook (a renderable object is
  // required — an empty Object3D never triggers onBeforeRender). A flat, camera-
  // facing Sprite reads as a soft additive bloom at the nozzle rather than a 3D
  // orb, and stays small relative to the ship.
  const glowMat = new THREE.SpriteMaterial({ map: tex, color: hot, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
  const probe = new THREE.Sprite(glowMat);
  probe.position.z = 1.9; // at the engine nozzle (+Z = aft)
  probe.frustumCulled = false;
  holder.add(probe);

  const trail: { x: number; y: number; z: number }[] = [];
  const nozzle = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let last = -1;
  let attached = false;
  let disposed = false;

  // When the player mesh is removed from the scene, disposeObject() walks the
  // holder and frees the probe's own geometry/material; we additionally tear
  // down the scene-parented ribbon (which disposeObject won't reach, since it's
  // reparented to the scene root) so it doesn't leak. The 'removed' event fires
  // on the object detached from its parent, so we listen on the holder itself.
  holder.addEventListener('removed', () => {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    geo.dispose(); // shared glow texture is app-lifetime; not disposed here
    for (const m of segs) (m.material as THREE.Material).dispose();
  });

  probe.onBeforeRender = () => {
    if (disposed) return;
    // Reparent the ribbon to the scene root once the ship is in the graph.
    if (!attached) {
      let root: THREE.Object3D = holder;
      while (root.parent) root = root.parent;
      root.add(group);
      attached = true;
    }

    const now = performance.now();
    if (last < 0) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    holder.updateWorldMatrix(true, false);
    // Nozzle sits behind the ship (+Z local); the bank (holder roll about Z)
    // swings it sideways so the plume sweeps to the outside of a turn.
    const roll = holder.rotation.z;
    nozzle.set(Math.sin(roll) * 2.6, 0, 2.4).applyMatrix4(holder.matrixWorld);

    const head = trail[0];
    let speed = 0;
    if (head) speed = nozzle.distanceTo(tmp.set(head.x, head.y, head.z)) / Math.max(dt, 0.001);
    trail.unshift({ x: nozzle.x, y: nozzle.y, z: nozzle.z });
    if (trail.length > TRAIL_SEGMENTS) trail.pop();

    const drive = Math.min(1, speed / 36); // 0 idle .. 1 fast

    // Engine bloom: brighter/bigger with throttle, plus a fast flicker. Kept
    // small (a soft nozzle glow, not an orb) — scale is in the holder's space.
    const flick = 0.85 + Math.sin(now * 0.04) * 0.15;
    glowMat.opacity = (0.3 + drive * 0.4) * flick;
    const gs = 0.32 + drive * 0.28;
    probe.scale.setScalar(gs * flick);

    for (let i = 0; i < segs.length; i++) {
      const m = segs[i];
      const pt = trail[i];
      if (!pt) { m.visible = false; continue; }
      const t = i / TRAIL_SEGMENTS; // 0 head .. 1 tail
      m.position.set(pt.x, pt.y, pt.z);
      const fade = (1 - t) * (1 - t);
      const w = (1.4 - t * 0.9) * (0.6 + drive * 0.9);
      const len = (2.2 - t * 0.8) * (0.7 + drive);
      m.scale.set(w, len, 1);
      (m.material as THREE.MeshBasicMaterial).opacity = fade * (0.22 + drive * 0.78);
      (m.material as THREE.MeshBasicMaterial).color.copy(i < 3 ? hot : baseCol);
      m.visible = true;
    }
  };
}

function bullet(color: number, sizePx: number, side: 'player' | 'enemy'): THREE.Object3D {
  const len = Math.max(0.8, sizePx * WORLD_SCALE);

  // Kenney laser bolt sprite (billboard, always faces the tilted camera) if the
  // texture is loaded; additive blending makes it glow. Falls back to a capsule.
  const tex = laserTexture(side);
  if (tex) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    if (side === 'enemy') mat.rotation = Math.PI; // bolt tip points down (toward player)
    const sp = new THREE.Sprite(mat);
    const h = len * 2.2; // streak length along travel
    sp.scale.set(h * 0.34, h, 1); // bolt aspect ~ tall and thin
    return sp;
  }

  const m = new THREE.Mesh(new THREE.CapsuleGeometry(len * 0.18, len, 4, 8), new THREE.MeshBasicMaterial({ color }));
  m.rotation.x = Math.PI / 2; // long axis along Z (travel)
  return m;
}

function powerup(color: number, sizePx: number): THREE.Object3D {
  const r = sizePx * WORLD_SCALE * 0.5;
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.3 }));
  m.userData.spin = true; // renderer spins the whole object about Y

  // Soft additive halo so the pickup glows and reads as "collectible", plus a
  // counter-phase sparkle sprite that twinkles for a "pickup me" shimmer.
  const tex = glowTex();
  const haloMat = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(r * 3.4);
  m.add(halo);

  const sparkMat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const spark = new THREE.Sprite(sparkMat);
  spark.scale.setScalar(r * 1.6);
  m.add(spark);

  m.onBeforeRender = () => {
    const t = performance.now() * 0.004;
    haloMat.opacity = 0.35 + (Math.sin(t) * 0.5 + 0.5) * 0.4;
    const p = (Math.sin(t * 1.7 + 1) * 0.5 + 0.5);
    sparkMat.opacity = 0.15 + p * 0.6;
    spark.scale.setScalar(r * (1.2 + p * 1.2));
  };
  // disposeObject frees the geometry + sprite materials; the glow texture is
  // shared/app-lifetime, so nothing extra to dispose here.
  return m;
}

function barrier(color: number, sizePx: number): THREE.Object3D {
  const w = sizePx * WORLD_SCALE;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.45, w * 0.6), new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.6, emissive: color, emissiveIntensity: 0.1 }));
  return m;
}

function bot(color: number, sizePx: number): THREE.Object3D {
  const r = sizePx * WORLD_SCALE * 0.5;
  return new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), new THREE.MeshBasicMaterial({ color }));
}

function missile(color: number, sizePx: number): THREE.Object3D {
  const holder = new THREE.Object3D();
  const len = sizePx * WORLD_SCALE;
  const c = new THREE.Mesh(new THREE.ConeGeometry(len * 0.3, len, 10), new THREE.MeshBasicMaterial({ color }));
  c.rotation.x = -Math.PI / 2; // point -Z
  holder.add(c);
  holder.userData.orient = true; // renderer yaws it along velocity
  return holder;
}

function bomb(color: number, sizePx: number): THREE.Object3D {
  const r = sizePx * WORLD_SCALE * 0.5;
  return new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.4 }));
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}

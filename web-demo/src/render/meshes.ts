import * as THREE from 'three';
import type { Entity } from '../world/types';
import { WORLD_SCALE } from '../config';
import { cloneShip } from './models';

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
    case 'ebullet':
      return bullet(e.color, e.scale);
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
  return holder;
}

function bullet(color: number, sizePx: number): THREE.Object3D {
  const len = Math.max(0.8, sizePx * WORLD_SCALE);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(len * 0.18, len, 4, 8), new THREE.MeshBasicMaterial({ color }));
  m.rotation.x = Math.PI / 2; // long axis along Z (travel)
  return m;
}

function powerup(color: number, sizePx: number): THREE.Object3D {
  const r = sizePx * WORLD_SCALE * 0.5;
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.3 }));
  m.userData.spin = true;
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

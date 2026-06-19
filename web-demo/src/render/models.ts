import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Kenney "Space Kit" CC0 glTF ships (public/models). Loaded once at boot; each
// template is normalized to unit length and oriented to face -Z (forward = up
// the screen) so the renderer can drop a clone into a banking holder, exactly
// like the primitive fallback. If loading fails, callers fall back to primitives.

// Tune if the Kenney nose points the wrong way after a screenshot check.
// 0 = face -Z (up the screen): player aims at the enemies, enemies (+= PI) aim
// back down at the player.
const MODEL_YAW = 0;

// role/behavior -> Space Kit file
const FILES: Record<string, string> = {
  player: 'craft_speederA',
  fighter: 'craft_speederB',
  smasher: 'meteor',
  builder: 'craft_cargoA',
  transport: 'craft_cargoB',
  demolisher: 'craft_miner',
  razer: 'craft_speederC',
  emitter: 'craft_speederD',
  phantom: 'alien',
  interceptor: 'craft_racer',
  boss: 'craft_cargoB',
  bosspart: 'craft_speederC',
};

const templates = new Map<string, THREE.Object3D>();
let ready = false;

export function modelsReady(): boolean {
  return ready;
}

export async function preloadModels(): Promise<void> {
  const loader = new GLTFLoader();
  const base = import.meta.env.BASE_URL;
  const unique = [...new Set(Object.values(FILES))];
  const loaded = new Map<string, THREE.Object3D>();
  await Promise.all(
    unique.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          loader.load(
            `${base}models/${name}.glb`,
            (gltf) => {
              loaded.set(name, normalize(gltf.scene));
              resolve();
            },
            undefined,
            reject
          );
        })
    )
  );
  for (const [role, file] of Object.entries(FILES)) {
    const tpl = loaded.get(file);
    if (tpl) templates.set(role, tpl);
  }
  ready = true;
}

/** A normalized, -Z-facing clone for the given role, or null if not loaded. */
export function cloneShip(role: string): THREE.Object3D | null {
  const tpl = templates.get(role);
  return tpl ? tpl.clone(true) : null;
}

// Center at origin, scale so the longest dimension == 1, face -Z.
function normalize(scene: THREE.Object3D): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = 1 / maxDim;
  scene.scale.setScalar(s);
  scene.position.set(-center.x * s, -center.y * s, -center.z * s);
  const wrap = new THREE.Group();
  wrap.add(scene);
  wrap.rotation.y = MODEL_YAW;
  return wrap;
}

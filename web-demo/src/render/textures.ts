import * as THREE from 'three';

// Kenney laser bolt sprites (public/sprites). Loaded once at boot and reused as
// the map for every bullet sprite. Player shots = blue bolt, enemy shots = red.
// If a texture fails to load, meshes.ts falls back to the procedural capsule.

const FILES: Record<string, string> = {
  player: 'laserBlue01',
  enemy: 'laserRed01',
};

const textures = new Map<string, THREE.Texture>();
let ready = false;

export function texturesReady(): boolean {
  return ready;
}

/** Loaded laser texture for 'player' | 'enemy', or null if not yet loaded. */
export function laserTexture(side: 'player' | 'enemy'): THREE.Texture | null {
  return textures.get(side) ?? null;
}

export async function preloadTextures(): Promise<void> {
  const loader = new THREE.TextureLoader();
  const base = import.meta.env.BASE_URL;
  await Promise.all(
    Object.entries(FILES).map(
      ([side, file]) =>
        new Promise<void>((resolve, reject) => {
          loader.load(
            `${base}sprites/${file}.png`,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.generateMipmaps = false;
              tex.minFilter = THREE.LinearFilter;
              textures.set(side, tex);
              resolve();
            },
            undefined,
            reject
          );
        })
    )
  );
  ready = true;
}

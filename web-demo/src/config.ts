// Canonical playfield + 3D mapping constants.
//
// The simulation (src/world) runs in a 2D LOGICAL playfield (720x1280, y down,
// same space the original Phaser build used) so all behavior math, slot spacing
// and level data carry over unchanged. The renderer (src/render) maps logical
// (x,y) onto a 3D ground plane: logical x -> world X, logical y -> world Z
// (top of field = far from camera). Ships hover slightly above the plane.

export const LOGICAL_W = 720;
export const LOGICAL_H = 1280;

/** Logical pixels -> world units. */
export const WORLD_SCALE = 0.1;

/** Hover height of ships/bullets above the ground plane. */
export const HOVER_Y = 2;

export function worldX(x: number): number {
  return (x - LOGICAL_W / 2) * WORLD_SCALE;
}
export function worldZ(y: number): number {
  return (y - LOGICAL_H / 2) * WORLD_SCALE;
}
export function logicalX(wx: number): number {
  return wx / WORLD_SCALE + LOGICAL_W / 2;
}
export function logicalY(wz: number): number {
  return wz / WORLD_SCALE + LOGICAL_H / 2;
}

// Banking (the headline 3D mechanic): a ship rolls into its horizontal travel,
// like a jet. target roll = -vx * K, clamped, then eased toward each frame.
export const BANK_K = 0.0016; // rad per (logical px/s)
export const BANK_MAX = 0.6; // ~34 degrees
export const BANK_LAMBDA = 9; // ease rate (higher = snappier)

/** "#rrggbb" -> 0xrrggbb numeric color for Phaser tints. */
export function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

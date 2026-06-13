/** "#rrggbb" -> 0xrrggbb numeric color for Phaser tints/fills. */
export function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function clamp8(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => clamp8(v).toString(16).padStart(2, '0')).join('');
}

/** Mix toward white by amt (0..1). */
export function lighten(hex: string, amt: number): string {
  const [r, g, b] = parse(hex);
  return toHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

/** Mix toward black by amt (0..1). */
export function darken(hex: string, amt: number): string {
  const [r, g, b] = parse(hex);
  return toHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
}

/** CSS rgba() string from a hex + alpha (for canvas gradients / text). */
export function rgba(hex: string, a: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Small geometry helpers shared by the sticker drawings (they replace the mockup's DOM-building loops). */
export const r2 = (n: number) => Math.round(n * 100) / 100;

export function quad(p0: [number, number], c: [number, number], p1: [number, number], t: number) {
  const u = 1 - t;
  return { x: r2(u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0]), y: r2(u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]) };
}

export const range = (n: number, from = 0) => Array.from({ length: n }, (_, i) => i + from);

/** Star or burst outline: alternating outer and inner radius around (cx, cy). */
export function starPoints(cx: number, cy: number, count: number, rOuter: number, rInner: number, odd: 'inner' | 'outer' = 'inner') {
  return range(count).map((i) => {
    const a = (i * 2 * Math.PI) / count - Math.PI / 2;
    const r = i % 2 === 1 ? (odd === 'inner' ? rInner : rOuter) : odd === 'inner' ? rOuter : rInner;
    return `${r2(cx + Math.cos(a) * r)},${r2(cy + Math.sin(a) * r)}`;
  }).join(' ');
}

import { FAIR_WORLD } from '@/lib/fair-constants';
import type { FairMaker } from '@/lib/fair-types';

/**
 * The fair floor: two parallel rows of four stalls, a lane between them and another along the front, joined by a corridor at each end.
 * Everything here is plain geometry (no canvas), so it is easy to test.
 */
export const WORLD_W = FAIR_WORLD.w, WORLD_H = FAIR_WORLD.h;
/** Scale of the stall artwork on the floor. */
export const STALL_SCALE = 0.72;
export const ROW_BASE = [250, 632] as const;
export const COL_X = [165, 405, 645, 885] as const;
export const START = { x: 525, y: 340 };

export type Pt = { x: number; y: number };
export type Rect = Pt & { w: number; h: number };
export type Slot = {
  idx: number; row: 0 | 1; col: number; cx: number; base: number;
  /** Where a visitor stands at the counter. */
  fx: number; fy: number;
  maker: FairMaker | null; open: boolean;
  att: number; hov: number; look: number;
};

/** Eight slots, row by row; makers fill them in order and the rest are open stalls. */
export function buildSlots(makers: FairMaker[]): Slot[] {
  return Array.from({ length: 8 }, (_, i) => {
    const row = (i < 4 ? 0 : 1) as 0 | 1, col = i % 4, maker = makers[i] ?? null;
    return { idx: i, row, col, cx: COL_X[col], base: ROW_BASE[row], fx: COL_X[col], fy: ROW_BASE[row] + 30, maker, open: !maker, att: 0, hov: 0, look: 0 };
  });
}
/** The floor you can walk on: the lane, the front lane and the two side corridors. */
export const RECTS: Rect[] = [
  { x: 0, y: 262, w: WORLD_W, h: 156 }, { x: 0, y: 646, w: WORLD_W, h: 118 },
  { x: 0, y: 262, w: 70, h: 502 }, { x: 980, y: 262, w: 70, h: 502 },
];
/** Corners of the ring around the stalls; routes that cannot go straight go round it. */
export const NODES: Pt[] = [{ x: 36, y: 340 }, { x: 1014, y: 340 }, { x: 1014, y: 705 }, { x: 36, y: 705 }];

const inRect = (p: Pt, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
export const walkable = (p: Pt) => RECTS.some(r => inRect(p, r));
/** The nearest walkable point to `p`. */
export function clampWalk(p: Pt): Pt {
  let best: { q: Pt; d: number } | null = null;
  for (const r of RECTS) {
    const q = { x: Math.max(r.x, Math.min(r.x + r.w, p.x)), y: Math.max(r.y, Math.min(r.y + r.h, p.y)) };
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (!best || d < best.d) best = { q, d };
  }
  return best!.q;
}
export function segOK(a: Pt, b: Pt): boolean {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8);
  for (let i = 0; i <= n; i++) if (!walkable({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n })) return false;
  return true;
}
/** Waypoints from `a` to `b` that stay on the floor: straight when possible, otherwise round the ring the short way. */
export function route(a: Pt, b: Pt): Pt[] {
  if (segOK(a, b)) return [{ x: b.x, y: b.y }];
  const idx = NODES.map((_, i) => i);
  const ent = idx.filter(i => segOK(a, NODES[i])), ext = idx.filter(i => segOK(NODES[i], b));
  let best: { len: number; pts: Pt[] } | null = null;
  for (const i of ent) for (const j of ext) for (const dir of [1, -1]) {
    let k = i, len = Math.hypot(a.x - NODES[i].x, a.y - NODES[i].y);
    const pts = [NODES[i]];
    while (k !== j) { const n = (k + dir + 4) % 4; len += Math.hypot(NODES[k].x - NODES[n].x, NODES[k].y - NODES[n].y); k = n; pts.push(NODES[k]); }
    len += Math.hypot(NODES[j].x - b.x, NODES[j].y - b.y);
    if (!best || len < best.len) best = { len, pts };
  }
  return best ? [...best.pts.map(p => ({ x: p.x, y: p.y })), { x: b.x, y: b.y }] : [{ x: b.x, y: b.y }];
}

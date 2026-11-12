import { describe, it, expect } from 'vitest';
import { COL_X, NODES, RECTS, ROW_BASE, START, WORLD_H, WORLD_W, buildSlots, clampWalk, route, segOK, walkable } from '@/components/fair/world';
import { SAMPLE_MAKERS, sampleFairData } from '@/lib/fair-sample';
import { cameraAxis } from '@/components/fair/world';

describe('buildSlots', () => {
  it('makes eight slots in two rows of four, makers first and open stalls after', () => {
    const slots = buildSlots(sampleFairData().stalls);
    expect(slots).toHaveLength(8);
    expect(slots.slice(0, 4).every(s => s.row === 0 && s.base === ROW_BASE[0])).toBe(true);
    expect(slots.slice(4).every(s => s.row === 1 && s.base === ROW_BASE[1])).toBe(true);
    expect(slots.map(s => s.cx)).toEqual([...COL_X, ...COL_X]);
    // you stand beside the maker, so the maker stays visible; on the mirror stall, on the side away from the mirror
    for (const sl of slots) expect(sl.fx).toBe(sl.cx + (sl.maker?.mirror ? -72 : 72));
    expect(slots.filter(s => !s.open).map(s => s.maker!.id)).toEqual(SAMPLE_MAKERS.map(m => m.id));
    expect(slots.slice(0, 5).map(s => s.label)).toEqual(['Handmade crochet', 'Resin Art', 'Wood craft', 'Sarees and suits', 'Christmas items']);
    expect(slots.filter(s => s.open)).toHaveLength(8 - SAMPLE_MAKERS.length);
  });
  it('all stalls are open when there are no makers', () => { expect(buildSlots([]).every(s => s.open && !s.maker)).toBe(true); });
  it('the counter spot of every stall is on the walkable floor', () => {
    for (const s of buildSlots(sampleFairData().stalls)) expect(walkable({ x: s.fx, y: s.fy })).toBe(true);
  });
});

describe('the floor', () => {
  it('the start point and the ring corners are walkable', () => {
    expect(walkable(START)).toBe(true);
    for (const n of NODES) expect(walkable(n)).toBe(true);
  });
  it('stalls are not walkable', () => {
    for (const x of COL_X) { expect(walkable({ x, y: ROW_BASE[0] - 40 })).toBe(false); expect(walkable({ x, y: ROW_BASE[1] - 40 })).toBe(false); }
  });
  it('clampWalk pulls any point onto the floor and leaves floor points alone', () => {
    expect(clampWalk({ x: 500, y: 340 })).toEqual({ x: 500, y: 340 });
    for (const p of [{ x: -50, y: -50 }, { x: 405, y: 500 }, { x: 5000, y: 5000 }, { x: 405, y: ROW_BASE[0] - 40 }]) expect(walkable(clampWalk(p))).toBe(true);
  });
  it('the rectangles stay inside the world', () => {
    for (const r of RECTS) { expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.w).toBeLessThanOrEqual(WORLD_W); expect(r.y + r.h).toBeLessThanOrEqual(WORLD_H); }
  });
});

describe('route', () => {
  const stays = (from: { x: number; y: number }, pts: { x: number; y: number }[]) => { let a = from; for (const b of pts) { if (!segOK(a, b)) return false; a = b; } return true; };
  it('goes straight along a lane', () => {
    expect(route({ x: 100, y: 340 }, { x: 900, y: 330 })).toEqual([{ x: 900, y: 330 }]);
  });
  it('goes round the ring from the lane to the front lane without crossing a stall', () => {
    const from = { x: 525, y: 340 }, to = { x: 645, y: 676 }, pts = route(from, to);
    expect(pts.length).toBeGreaterThan(1);
    expect(pts.at(-1)).toEqual(to);
    expect(stays(from, pts)).toBe(true);
  });
  it('picks the nearer end of the ring', () => {
    const left = route({ x: 120, y: 340 }, { x: 140, y: 676 }), right = route({ x: 960, y: 340 }, { x: 940, y: 676 });
    expect(left.some(p => p.x < 100)).toBe(true);
    expect(right.some(p => p.x > 950)).toBe(true);
  });
  it('every stall counter can be reached from the start', () => {
    for (const s of buildSlots(sampleFairData().stalls)) { const pts = route(START, { x: s.fx, y: s.fy }); expect(stays(START, pts)).toBe(true); expect(pts.at(-1)).toEqual({ x: s.fx, y: s.fy }); }
  });
});

describe('cameraAxis', () => {
  it('centres a world that is smaller than the view', () => { expect(cameraAxis(0, 600, 1000)).toBe(-200); });
  it('keeps the camera inside a world that is bigger than the view', () => {
    expect(cameraAxis(-50, 2000, 1000)).toBe(0);
    expect(cameraAxis(500, 2000, 1000)).toBe(500);
    expect(cameraAxis(5000, 2000, 1000)).toBe(1000);
  });
});

import { describe, it, expect } from 'vitest';
import { ACTIVITIES } from '@/lib/fair-mela';
import { FOLK_SECONDS, folkScore } from '@/components/fair/folk';
import { OPPONENT_PULL, TAP_PULL, TUG_SECONDS, opponentPull, tugResult, tugTap, tugTick } from '@/components/fair/tug';
import { PLACE_LABEL, buildSlots, lakeIndex, placeIndexes, walkable } from '@/components/fair/world';
import { sampleFairData } from '@/lib/fair-sample';
import { stallsOf } from '@/lib/fair-stalls';

const sample = sampleFairData();
const withMakers = (n: number) => stallsOf(Array.from({ length: n }, (_, i) => ({ ...sample.makers[i % sample.makers.length], id: `m${i}` })));

describe('the places of the mela', () => {
  it('turns the last open stalls into the lake, the music stage and the sports ring, from the bottom right', () => {
    expect(placeIndexes(sample.stalls)).toEqual({ lake: 7, music: 6, sports: 5 });
    expect(lakeIndex(sample.stalls)).toBe(7);
  });
  it('gives the lake first and leaves out what has no room', () => {
    expect(placeIndexes(withMakers(6))).toEqual({ lake: 7, music: 6, sports: -1 });
    expect(placeIndexes(withMakers(7))).toEqual({ lake: 7, music: -1, sports: -1 });
    expect(placeIndexes(withMakers(8))).toEqual({ lake: -1, music: -1, sports: -1 });
  });
  it('builds them as slots with no maker, named for what they are, with a walkable spot to stand', () => {
    const slots = buildSlots(sample.stalls, true), places = slots.filter(s => s.place);
    expect(places.map(s => [s.idx, s.place, s.label])).toEqual([[5, 'sports', PLACE_LABEL.sports], [6, 'music', PLACE_LABEL.music], [7, 'lake', PLACE_LABEL.lake]]);
    for (const s of places) { expect(s.maker).toBeNull(); expect(s.open).toBe(false); expect(walkable({ x: s.fx, y: s.fy })).toBe(true); }
    expect(slots.filter(s => s.lake)).toHaveLength(1);
  });
  it('keeps every stall as it was outside the mela', () => { expect(buildSlots(sample.stalls).some(s => s.place || s.lake)).toBe(false); });
  it('lists the four activities', () => { expect(ACTIVITIES.map(a => a.id)).toEqual(['balloon', 'music', 'sports', 'market']); });
});

describe('tug of war', () => {
  it('the other team pulls the rope their way all the time, in waves, and a tap pulls it yours', () => {
    expect(tugTick(0, 1, 0)).toBeLessThan(0);
    expect(opponentPull(0)).toBeGreaterThan(OPPONENT_PULL * .7);
    expect(opponentPull(1)).toBeLessThan(OPPONENT_PULL * 1.3);
    expect(tugTap(0)).toBeCloseTo(TAP_PULL);
    expect(tugTap(.98)).toBe(1);
    expect(tugTick(-.99, 5, 0)).toBe(-1);
  });
  it('is won or lost over the line, or on the side the rope is on when time is up', () => {
    expect(tugResult(0, 3)).toBeNull();
    expect(tugResult(1, 3)).toBe('won');
    expect(tugResult(-1, 3)).toBe('lost');
    expect(tugResult(.2, TUG_SECONDS)).toBe('won');
    expect(tugResult(-.2, TUG_SECONDS)).toBe('lost');
    expect(tugResult(0, TUG_SECONDS)).toBe('lost');
  });
  it('can be won by tapping about five times a second', () => {
    let pos = 0; const dt = .05;
    for (let t = 0; t < TUG_SECONDS && tugResult(pos, t) === null; t += dt) { pos = tugTick(pos, dt, t); if (Math.round(t / dt) % 4 === 0) pos = tugTap(pos); }
    expect(pos).toBeGreaterThan(0);
  });
  it('is lost by standing still', () => {
    let pos = 0, t = 0; const dt = .05;
    while (tugResult(pos, t) === null) { pos = tugTick(pos, dt, t); t += dt; }
    expect(tugResult(pos, t)).toBe('lost');
  });
});

describe('folk music', () => {
  const score = folkScore();
  it('has a drone, a rhythm and a tune, in time order, inside its length', () => {
    expect(new Set(score.map(n => n.kind))).toEqual(new Set(['drone', 'bass', 'slap', 'pluck']));
    expect(score.map(n => n.t)).toEqual([...score.map(n => n.t)].sort((a, b) => a - b));
    expect(score.every(n => n.t >= 0 && n.t < FOLK_SECONDS)).toBe(true);
  });
  it('is the same every time', () => { expect(folkScore()).toEqual(score); });
  it('plays the tune in the notes of raga Bhupali, between Sa and the high Sa', () => {
    const SA = 146.83, ratios = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
    for (const n of score.filter(n => n.kind === 'pluck')) expect(ratios.some(r => Math.abs(n.hz - SA * 2 * r) < .01)).toBe(true);
  });
});

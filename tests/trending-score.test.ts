import { describe, it, expect } from 'vitest';
import { WEIGHTS, pickDiverse, scoreSignals, type Signals } from '@/lib/trending';

const s = (id: string, seller: string, v = 0, c = 0, a = 0, l = 0): Signals => ({ productId: id, sellerId: seller, views: v, contact: c, artist: a, likes: l });

describe('scoreSignals', () => {
  it('weights are the agreed mix and sum to 1', () => {
    expect(WEIGHTS).toEqual({ views: 0.35, contact: 0.25, artist: 0.2, likes: 0.2 });
    expect(Object.values(WEIGHTS).reduce((x, y) => x + y, 0)).toBeCloseTo(1, 10);
  });
  it('normalises each signal by its own maximum and applies the weights', () => {
    const out = scoreSignals([s('p1', 'a', 10, 0, 0, 0), s('p2', 'b', 5, 4, 2, 10), s('p3', 'c', 0, 4, 2, 0)]);
    const by = Object.fromEntries(out.map(r => [r.productId, r.score]));
    expect(by.p1).toBeCloseTo(0.35 * 1, 10);                                      // best on views only
    expect(by.p2).toBeCloseTo(0.35 * 0.5 + 0.25 * 1 + 0.2 * 1 + 0.2 * 1, 10);     // balanced
    expect(by.p3).toBeCloseTo(0.25 * 1 + 0.2 * 1, 10);
    expect(out.map(r => r.productId)).toEqual(['p2', 'p3', 'p1']);                  // balanced beats one-signal; p3 (.45) beats p1 (.35)
  });
  it('a signal that is zero for everyone does not divide by zero or distort the others', () => {
    const out = scoreSignals([s('p1', 'a', 4, 0, 0, 0), s('p2', 'b', 3, 0, 0, 0)]);
    expect(out.map(r => r.productId)).toEqual(['p1', 'p2']);
    expect(out[0].score).toBeCloseTo(0.35, 10); expect(out[1].score).toBeCloseTo(0.2625, 10);
    expect(out.every(r => Number.isFinite(r.score))).toBe(true);
  });
  it('drops products with no signal at all; empty input gives empty output', () => {
    expect(scoreSignals([s('p1', 'a'), s('p2', 'b')])).toEqual([]);
    expect(scoreSignals([])).toEqual([]);
    expect(scoreSignals([s('p1', 'a'), s('p2', 'b', 3)]).map(r => r.productId)).toEqual(['p2']);
    expect(scoreSignals([s('p1', 'a', 1), s('p2', 'b', 2, 0, 5)])).toEqual([]);                  // a few views, or an artist click, are not enough
    expect(scoreSignals([s('p1', 'a', 0, 1), s('p2', 'b', 0, 0, 0, 1)]).map(r => r.productId)).toEqual(['p1', 'p2']); // a contact click or a like is
  });
  it('ties: more likes first, then the newer (higher numeric) id', () => {
    const out = scoreSignals([s('p2', 'a', 3, 0, 0, 0), s('p10', 'b', 3, 0, 0, 0)]);
    expect(out.map(r => r.productId)).toEqual(['p10', 'p2']);                       // p10 is newer than p2 (numeric, not text)
    const likes = scoreSignals([s('p1', 'a', 0, 0, 0, 2), s('p9', 'b', 0, 0, 0, 2), s('p5', 'c', 0, 0, 0, 2)]);
    expect(likes.map(r => r.productId)).toEqual(['p9', 'p5', 'p1']);
  });
});

describe('pickDiverse', () => {
  const sorted = [s('p1', 'a'), s('p2', 'a'), s('p3', 'b'), s('p4', 'c'), s('p5', 'b'), s('p6', 'd')];
  it('keeps the best product of each artist and fills up to the limit', () => {
    expect(pickDiverse(sorted, 3).map(r => r.productId)).toEqual(['p1', 'p3', 'p4']);
    expect(pickDiverse(sorted, 10).map(r => r.productId)).toEqual(['p1', 'p3', 'p4', 'p6']);   // fewer artists than the limit: no padding with repeats
  });
  it('perArtist=2 allows a second product per artist, never a third', () => {
    expect(pickDiverse(sorted, 10, 2).map(r => r.productId)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    expect(pickDiverse([s('p1', 'a'), s('p2', 'a'), s('p3', 'a')], 10, 2).map(r => r.productId)).toEqual(['p1', 'p2']);
  });
  it('limit 0 or negative gives nothing; input order is preserved', () => {
    expect(pickDiverse(sorted, 0)).toEqual([]);
    expect(pickDiverse(sorted, -3)).toEqual([]);
  });
});

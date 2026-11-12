import { describe, it, expect } from 'vitest';
import { GIFT_LIMIT_PAISE, applyEvent, availableQuests, countOf, dayKey, emptyState, isDone, mergeProgress, questsFor, restoreState } from '@/components/fair/quests';
import { makersOf, stallsOf } from '@/lib/fair-stalls';
import { sampleFairData } from '@/lib/fair-sample';
import type { FairData } from '@/lib/fair-types';

const sample = sampleFairData();
const mk = (makers: FairData['makers']): FairData => ({ source: 'real', stalls: stallsOf(makers), makers: makersOf(stallsOf(makers)) });
const noMirror = mk(sample.makers.map(m => ({ ...m, mirror: false })));
const ids = (d: FairData) => availableQuests(d).map(q => q.id);

describe('dayKey', () => {
  it('uses the date in India, so the day turns over at Indian midnight', () => {
    expect(dayKey(new Date('2026-11-12T18:29:00Z'))).toBe('2026-11-12');
    expect(dayKey(new Date('2026-11-12T18:31:00Z'))).toBe('2026-11-13');
  });
});

describe('availableQuests', () => {
  it('offers the mirror quests only when a stall has a mirror, and try-on only when it has something to wear', () => {
    expect(ids(sample)).toEqual(expect.arrayContaining(['meet3', 'gift500', 'tryon', 'selfie', 'craft', 'note', 'emote']));
    expect(ids(noMirror)).not.toEqual(expect.arrayContaining(['selfie']));
    expect(ids(noMirror)).not.toContain('note');
    expect(ids(noMirror)).not.toContain('tryon');
  });
  it('offers the gift quest only when something costs ₹500 or less', () => {
    const dear = mk(sample.makers.map(m => ({ ...m, items: m.items.map(i => ({ ...i, pricePaise: GIFT_LIMIT_PAISE + 100 })) })));
    expect(ids(dear)).not.toContain('gift500');
  });
  it('shrinks the meet quest to the number of makers', () => {
    expect(availableQuests(mk(sample.makers.slice(0, 2))).find(q => q.id === 'meet3')!.target).toBe(2);
    expect(availableQuests(mk([]))).toEqual([expect.objectContaining({ id: 'emote' })]);
  });
});

describe('questsFor', () => {
  it('gives three different quests, the same for everyone on the same day', () => {
    const a = questsFor(sample, '2026-11-12'), b = questsFor(sample, '2026-11-12');
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(new Set(a.map(q => q.id)).size).toBe(3);
  });
  it('changes from day to day', () => {
    const seen = new Set(Array.from({ length: 12 }, (_, i) => questsFor(sample, `2026-11-${10 + i}`).map(q => q.id).join()));
    expect(seen.size).toBeGreaterThan(3);
  });
  it('never offers more quests than exist', () => { expect(questsFor(mk([]), '2026-11-12')).toHaveLength(1); });
});

describe('applyEvent', () => {
  const quests = availableQuests(sample);
  const meet = quests.find(q => q.id === 'meet3')!, gift = quests.find(q => q.id === 'gift500')!;
  it('counts each maker once and completes at the target', () => {
    let s = emptyState('d');
    for (const id of ['dhaga', 'dhaga', 'kundan']) s = applyEvent(s, [meet], { type: 'visit', makerId: id }).state;
    expect(countOf(s, meet)).toBe(2);
    expect(isDone(s, meet)).toBe(false);
    const r = applyEvent(s, [meet], { type: 'visit', makerId: 'mitti' });
    expect(r.completed).toEqual([meet]);
    expect(isDone(r.state, meet)).toBe(true);
    expect(applyEvent(r.state, [meet], { type: 'visit', makerId: 'resin' }).completed).toEqual([]);
  });
  it('the gift quest counts ₹500 but not ₹501', () => {
    expect(applyEvent(emptyState('d'), [gift], { type: 'shortlist', itemKey: 'a', pricePaise: 50_000 }).completed).toEqual([gift]);
    expect(applyEvent(emptyState('d'), [gift], { type: 'shortlist', itemKey: 'a', pricePaise: 50_100 }).completed).toEqual([]);
  });
  it('ignores events that do not belong to any quest and never mutates the old state', () => {
    const s = emptyState('d'), r = applyEvent(s, [meet], { type: 'selfie' });
    expect(r.state.progress).toEqual({}); expect(s.progress).toEqual({});
  });
  it('one event can complete several quests', () => {
    const all = availableQuests(sample), tryon = all.find(q => q.id === 'tryon')!, craft = all.find(q => q.id === 'craft')!;
    expect(applyEvent(emptyState('d'), [tryon, craft], { type: 'tryon', itemKey: 'x' }).completed).toEqual([tryon]);
    expect(applyEvent(emptyState('d'), [tryon, craft], { type: 'craft', makerId: 'dhaga' }).completed).toEqual([craft]);
  });
});

describe('restoreState', () => {
  it('keeps today\'s progress and drops yesterday\'s or junk', () => {
    expect(restoreState({ day: 'd', progress: { meet3: ['a', 'b', 5] } }, 'd')).toEqual({ day: 'd', progress: { meet3: ['a', 'b'] } });
    expect(restoreState({ day: 'old', progress: { meet3: ['a'] } }, 'd')).toEqual(emptyState('d'));
    for (const junk of [null, 'x', 3, {}, { day: 'd' }, { day: 'd', progress: 5 }]) expect(restoreState(junk, 'd')).toEqual(emptyState('d'));
  });
});

describe('mergeProgress', () => {
  it('keeps what both this browser and the server remember', () => {
    const local = { day: 'd', progress: { meet3: ['a'], craft: ['x'] } };
    const merged = mergeProgress(local, { meet3: ['a', 'b'], note: ['note'] });
    expect(merged.progress).toEqual({ meet3: ['a', 'b'], craft: ['x'], note: ['note'] });
    expect(local.progress).toEqual({ meet3: ['a'], craft: ['x'] });
  });
  it('does nothing without saved progress, and ignores junk', () => {
    const s = emptyState('d');
    expect(mergeProgress(s, undefined)).toBe(s);
    expect(mergeProgress(s, { meet3: [5, 'a'] as unknown as string[] }).progress).toEqual({ meet3: ['a'] });
  });
});

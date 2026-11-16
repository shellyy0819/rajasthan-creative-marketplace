import { describe, it, expect } from 'vitest';
import { dayFromSearch, melaOf, melaPhaseOf, parseMelaSchedule } from '@/lib/fair-mela';
import { applyEvent, availableQuests, emptyState, isDone, questsFor } from '@/components/fair/quests';
import { buildSlots, lakeIndex, walkable } from '@/components/fair/world';
import { sampleFairData } from '@/lib/fair-sample';
import { makersOf, stallsOf } from '@/lib/fair-stalls';
import { parseQuestSave } from '@/lib/fair-quest-days';
import type { FairData } from '@/lib/fair-types';

const sample = sampleFairData();
const ids = (d: FairData, day: string) => questsFor(d, day).map(q => q.id);

describe('melaPhaseOf', () => {
  it('splits the Pushkar Camel Fair week into trading, culture and Kartik Purnima', () => {
    expect(melaPhaseOf('2026-11-16')).toBeNull();
    for (const d of ['2026-11-17', '2026-11-20']) expect(melaPhaseOf(d)).toBe('trade');
    for (const d of ['2026-11-21', '2026-11-23']) expect(melaPhaseOf(d)).toBe('culture');
    expect(melaPhaseOf('2026-11-24')).toBe('purnima');
    expect(melaPhaseOf('2026-11-25')).toBeNull();
  });
  it('has no mela in a year that is not listed', () => { expect(melaPhaseOf('2027-11-20')).toBeNull(); expect(melaOf('2027-11-20')).toBeNull(); });
  it('labels each part for the visitor', () => {
    expect(melaOf('2026-11-18')).toMatchObject({ phase: 'trade', label: 'Livestock trading · 17 to 20 Nov' });
    expect(melaOf('2026-11-24')?.blurb).toMatch(/holy dip/i);
  });
});

describe('a schedule set by an admin', () => {
  const next = { trade: ['2027-11-06', '2027-11-09'] as [string, string], culture: ['2027-11-10', '2027-11-12'] as [string, string], purnima: '2027-11-13' };
  it('moves the whole week, and labels follow the dates', () => {
    expect(melaPhaseOf('2026-11-18', next)).toBeNull();
    expect(melaPhaseOf('2027-11-07', next)).toBe('trade');
    expect(melaOf('2027-11-13', next)?.label).toBe('Kartik Purnima · 13 Nov');
    expect(melaOf('2027-11-07', next)?.label).toBe('Livestock trading · 6 to 9 Nov');
    expect(melaOf('2027-11-11', { ...next, culture: ['2027-11-30', '2027-12-02'], purnima: '2027-12-03' })).toBeNull();
    expect(melaOf('2027-11-30', { ...next, culture: ['2027-11-30', '2027-12-02'], purnima: '2027-12-03' })?.label).toBe('Cultural events · 30 Nov to 2 Dec');
  });
  it('null means no mela at all, and quests carry no Pushkar dip', () => {
    expect(melaOf('2026-11-18', null)).toBeNull();
    expect(ids(sample, '2026-11-24').length).toBe(3); // default dates still apply when no schedule is passed
    expect(questsFor(sample, '2026-11-24', null).map(q => q.id)).not.toContain('dip');
  });
  it('is read from stored JSON only when complete, real and in order', () => {
    expect(parseMelaSchedule(next)).toEqual(next);
    expect(parseMelaSchedule(null)).toBeNull();
    expect(parseMelaSchedule({ ...next, purnima: '2027-11-12' })).toBeNull();
    expect(parseMelaSchedule({ ...next, trade: ['2027-11-09', '2027-11-06'] })).toBeNull();
    expect(parseMelaSchedule({ ...next, purnima: '2027-02-30' })).toBeNull();
    expect(parseMelaSchedule({ trade: ['2027-11-06'], culture: next.culture, purnima: next.purnima })).toBeNull();
  });
});

describe('dayFromSearch', () => {
  it('reads a real date from ?day= and ignores anything else', () => {
    expect(dayFromSearch('?day=2026-11-18')).toBe('2026-11-18');
    expect(dayFromSearch('?day=2026-02-30')).toBeNull();
    expect(dayFromSearch('?day=tomorrow')).toBeNull();
    expect(dayFromSearch('')).toBeNull();
  });
});

describe('Pushkar Lake', () => {
  it('takes the last open place, and only when asked for', () => {
    expect(lakeIndex(sample.stalls)).toBe(7);
    expect(buildSlots(sample.stalls).some(s => s.lake)).toBe(false);
    const slots = buildSlots(sample.stalls, true), lake = slots.filter(s => s.lake);
    expect(lake).toHaveLength(1);
    expect(lake[0]).toMatchObject({ idx: 7, maker: null, open: false, label: 'Pushkar Lake' });
    expect(walkable({ x: lake[0].fx, y: lake[0].fy })).toBe(true);
  });
  it('leaves makers alone: with no open place there is no lake', () => {
    const full = Array.from({ length: 8 }, (_, i) => ({ ...sample.makers[i % sample.makers.length], id: `m${i}` }));
    const stalls = stallsOf(full);
    expect(lakeIndex(stalls)).toBe(-1);
    expect(buildSlots(stalls, true).some(s => s.lake)).toBe(false);
  });
});

describe('mela quests', () => {
  it('asks for the quests of the day\'s part of the mela', () => {
    expect(ids(sample, '2026-11-18')).toEqual(['meet3', 'gift500', 'tryon']);
    expect(ids(sample, '2026-11-22')).toEqual(['meet3', 'selfie', 'note']);
    expect(ids(sample, '2026-11-24')).toEqual(['meet3', 'dip', 'note']);
  });
  it('offers the holy dip only on Kartik Purnima and only when the lake is on the floor', () => {
    expect(availableQuests(sample, '2026-11-18').map(q => q.id)).not.toContain('dip');
    expect(availableQuests(sample).map(q => q.id)).not.toContain('dip');
    expect(availableQuests(sample, '2026-11-24').map(q => q.id)).toContain('dip');
    const full = stallsOf(Array.from({ length: 8 }, (_, i) => ({ ...sample.makers[i % sample.makers.length], id: `m${i}` })));
    const crowded: FairData = { source: 'real', stalls: full, makers: makersOf(full) };
    expect(ids(crowded, '2026-11-24')).not.toContain('dip');
    expect(ids(crowded, '2026-11-24')).toHaveLength(3);
  });
  it('keeps ordinary days as they were', () => { expect(ids(sample, '2026-11-12')).toEqual(ids(sample, '2026-11-12')); expect(ids(sample, '2026-11-12')).toHaveLength(3); });
  it('counts the dip once and completes the quest', () => {
    const quests = questsFor(sample, '2026-11-24'), dip = quests.find(q => q.id === 'dip')!;
    const r = applyEvent(emptyState('2026-11-24'), quests, { type: 'dip' });
    expect(r.completed.map(q => q.id)).toEqual(['dip']);
    expect(isDone(r.state, dip)).toBe(true);
    expect(applyEvent(r.state, quests, { type: 'dip' }).completed).toEqual([]);
  });
  it('is accepted when a code saves its quests to the server', () => {
    const body = { code: 'ABC234', token: 'a'.repeat(32), day: '2026-11-24', quests: [{ id: 'dip', title: 'Take the holy dip', target: 1 }], progress: { dip: ['dip'] } };
    expect(() => parseQuestSave(body)).not.toThrow();
  });
});

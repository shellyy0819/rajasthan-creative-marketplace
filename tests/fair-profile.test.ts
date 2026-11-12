import { describe, it, expect } from 'vitest';
import { MAX_NOTES, MAX_QTY, NOTE_MAX, STORE_KEY, cartCount, cleanProfile, emptyProfile, loadStore, saveStore } from '@/components/fair/profile';

const makers = new Set(['dhaga', 'kundan']), items = new Set(['dhaga:0', 'kundan:1']);

describe('cleanProfile', () => {
  it('keeps valid data and drops makers and items that are gone', () => {
    const p = cleanProfile({ met: ['dhaga', 'gone', 'dhaga', 5], shortlist: { 'dhaga:0': 2, 'gone:0': 1, 'kundan:1': 0, 'x': 'y' }, notes: [{ text: 'Lovely', rating: 4, t: 1 }, { text: '  ', rating: 1, t: 2 }, null], quests: { a: 1 } }, makers, items);
    expect(p).toEqual({ met: ['dhaga'], shortlist: { 'dhaga:0': 2 }, notes: [{ text: 'Lovely', rating: 4, t: 1 }], quests: { a: 1 }, look: null });
  });
  it('caps quantities, note length and the number of notes, and fixes ratings', () => {
    const notes = Array.from({ length: MAX_NOTES + 5 }, (_, i) => ({ text: 'x'.repeat(NOTE_MAX + 50), rating: 9, t: i }));
    const p = cleanProfile({ shortlist: { 'dhaga:0': 500 }, notes }, makers, items);
    expect(p.shortlist['dhaga:0']).toBe(MAX_QTY);
    expect(p.notes).toHaveLength(MAX_NOTES);
    expect(p.notes[0].text).toHaveLength(NOTE_MAX);
    expect(p.notes.every(n => n.rating === 0)).toBe(true);
  });
  it('keeps a valid look and drops an unknown one', () => {
    expect(cleanProfile({ look: 'f3' }, makers, items).look).toBe('f3');
    expect(cleanProfile({ look: 'zz' }, makers, items).look).toBeNull();
  });
  it('turns anything unreadable into an empty profile', () => {
    for (const junk of [null, undefined, 'x', 4, [], { met: 'no', shortlist: 5, notes: {} }]) expect(cleanProfile(junk, makers, items)).toEqual(emptyProfile());
  });
});

describe('loadStore / saveStore', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
  it('round-trips', () => {
    const s = mem(), store = { current: 'ABC234', profiles: { ABC234: { ...emptyProfile(), met: ['dhaga'] } } };
    saveStore(s, store);
    expect(JSON.parse(s.getItem(STORE_KEY)!)).toEqual(store);
    expect(loadStore(s)).toEqual(store);
  });
  it('starts fresh when storage is missing, empty, corrupt or throws', () => {
    expect(loadStore(null)).toEqual({ current: '', profiles: {} });
    expect(loadStore({ getItem: () => 'not json' })).toEqual({ current: '', profiles: {} });
    expect(loadStore({ getItem: () => '{"profiles":null}' })).toEqual({ current: '', profiles: {} });
    expect(loadStore({ getItem: () => { throw new Error('blocked'); } })).toEqual({ current: '', profiles: {} });
    expect(() => saveStore({ setItem: () => { throw new Error('full'); } }, { current: '', profiles: {} })).not.toThrow();
  });
  it('counts shortlist items', () => { expect(cartCount({ a: 2, b: 3 })).toBe(5); expect(cartCount({})).toBe(0); });
});

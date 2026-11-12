import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ACTIVE_MS, CODE_ALPHABET, KEEP_MS, MAX_VISIBLE, heartbeat, parseHeartbeat } from '@/lib/fair-presence';
import { eq } from 'drizzle-orm';
import { fairVisitors } from '@/db/schema';
import { getTestDb, resetTestDb } from './helpers/testdb';

const hb = (code: string, o: Record<string, unknown> = {}) => parseHeartbeat({ code, x: 100, y: 300, facing: 'down', ...o });
const T0 = new Date('2026-11-12T10:00:00Z');
const at = (s: number) => new Date(T0.getTime() + s * 1000);
beforeEach(async () => { await resetTestDb(); });

describe('parseHeartbeat', () => {
  it('accepts a valid heartbeat and rounds positions', () => {
    expect(parseHeartbeat({ code: 'ABC234', x: 10.04, y: 20.06, facing: 'left' })).toEqual({ code: 'ABC234', x: 10, y: 20.1, facing: 'left' });
  });
  it('clamps positions to the fair floor', () => {
    expect(parseHeartbeat({ code: 'ABC234', x: -50, y: 99999, facing: 'up' })).toMatchObject({ x: 0, y: 780 });
  });
  it('rejects codes that are the wrong length or use confusing characters', () => {
    for (const code of ['ABC23', 'ABC2345', 'ABO234', 'AB1234', 'abc234', '', 5, null]) expect(() => parseHeartbeat({ code, x: 1, y: 1, facing: 'up' })).toThrow(/code/);
  });
  it('rejects bad numbers, facings and emotes', () => {
    expect(() => parseHeartbeat({ code: 'ABC234', x: 'a', y: 1, facing: 'up' })).toThrow(/x must/);
    expect(() => parseHeartbeat({ code: 'ABC234', x: 1, y: NaN, facing: 'up' })).toThrow(/y must/);
    expect(() => parseHeartbeat({ code: 'ABC234', x: 1, y: 1, facing: 'sideways' })).toThrow(/facing/);
    expect(() => parseHeartbeat({ code: 'ABC234', x: 1, y: 1, facing: 'up', emote: 'dance' })).toThrow(/emote/);
  });
  it('the alphabet matches the client codes (no O, I, L, 0, 1)', () => {
    expect(CODE_ALPHABET).not.toMatch(/[OIL01]/);
    expect(CODE_ALPHABET).toHaveLength(31);
  });
});

describe('heartbeat', () => {
  it('shows each visitor to the other, never to themselves, and counts everyone', async () => {
    await heartbeat(hb('AAAAAA', { x: 10 }), at(0));
    const r = await heartbeat(hb('BBBBBB', { x: 20 }), at(1));
    expect(r.count).toBe(2);
    expect(r.visitors.map(v => v.code)).toEqual(['AAAAAA']);
    expect(r.visitors[0]).toMatchObject({ x: 10, y: 300, facing: 'down', emote: null, emoteSeq: 0 });
    expect((await heartbeat(hb('AAAAAA', { x: 11 }), at(2))).visitors.map(v => v.code)).toEqual(['BBBBBB']);
  });
  it('updates a visitor in place instead of adding rows', async () => {
    for (let i = 0; i < 3; i++) await heartbeat(hb('AAAAAA', { x: i * 10 }), at(i));
    const rows = await (await getTestDb()).select().from(fairVisitors);
    expect(rows).toHaveLength(1);
    expect(rows[0].x).toBe(20);
  });
  it('drops visitors who have not been heard from recently, and deletes old rows', async () => {
    await heartbeat(hb('AAAAAA'), at(0));
    const later = await heartbeat(hb('BBBBBB'), at(ACTIVE_MS / 1000 + 1));
    expect(later.visitors).toEqual([]);
    expect(later.count).toBe(1);
    await heartbeat(hb('BBBBBB'), at(KEEP_MS / 1000 + 5));
    expect(await (await getTestDb()).select().from(fairVisitors).where(eq(fairVisitors.code, 'AAAAAA'))).toEqual([]);
  });
  it('an emote bumps the counter once and later plain heartbeats keep it', async () => {
    await heartbeat(hb('AAAAAA', { emote: 'wave' }), at(0));
    let seen = (await heartbeat(hb('BBBBBB'), at(1))).visitors[0];
    expect(seen).toMatchObject({ emote: 'wave', emoteSeq: 1 });
    await heartbeat(hb('AAAAAA'), at(2));
    seen = (await heartbeat(hb('BBBBBB'), at(3))).visitors[0];
    expect(seen).toMatchObject({ emote: 'wave', emoteSeq: 1 });
    await heartbeat(hb('AAAAAA', { emote: 'namaste' }), at(4));
    seen = (await heartbeat(hb('BBBBBB'), at(5))).visitors[0];
    expect(seen).toMatchObject({ emote: 'namaste', emoteSeq: 2 });
  });
  it('lists at most MAX_VISIBLE others but counts everyone', async () => {
    const codes = Array.from({ length: MAX_VISIBLE + 5 }, (_, i) => `${CODE_ALPHABET[Math.floor(i / 31)]}${CODE_ALPHABET[i % 31]}AAAA`);
    for (const [i, c] of codes.entries()) await heartbeat(hb(c), at(i * 0.1));
    const r = await heartbeat(hb('ZZZZZZ'), at(5));
    expect(r.visitors).toHaveLength(MAX_VISIBLE);
    expect(r.count).toBe(codes.length + 1);
  });
});

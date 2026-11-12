import { describe, it, expect, beforeEach } from 'vitest';
import { ACTIVE_MS, CODE_ALPHABET, KEEP_MS, MAX_VISIBLE, heartbeat, parseHeartbeat } from '@/lib/fair-presence';
import { eq } from 'drizzle-orm';
import { fairVisitors } from '@/db/schema';
import { getTestDb, resetTestDb } from './helpers/testdb';

const TOKEN = 'a'.repeat(32), OTHER = 'b'.repeat(32);
const hb = (code: string, o: Record<string, unknown> = {}) => parseHeartbeat({ code, token: TOKEN, x: 100, y: 300, facing: 'down', ...o });
const T0 = new Date('2026-11-12T10:00:00Z');
const at = (s: number) => new Date(T0.getTime() + s * 1000);
beforeEach(async () => { await resetTestDb(); });

describe('parseHeartbeat', () => {
  it('accepts a valid heartbeat and rounds positions', () => {
    expect(parseHeartbeat({ code: 'ABC234', token: TOKEN, x: 10.04, y: 20.06, facing: 'left' })).toEqual({ code: 'ABC234', token: TOKEN, x: 10, y: 20.1, facing: 'left' });
  });
  it('clamps positions to the fair floor', () => {
    expect(parseHeartbeat({ code: 'ABC234', token: TOKEN, x: -50, y: 99999, facing: 'up' })).toMatchObject({ x: 0, y: 780 });
  });
  it('rejects codes that are the wrong length or use confusing characters', () => {
    for (const code of ['ABC23', 'ABC2345', 'ABO234', 'AB1234', 'abc234', '', 5, null]) expect(() => parseHeartbeat({ code, token: TOKEN, x: 1, y: 1, facing: 'up' })).toThrow(/code/);
  });
  it('needs the secret that proves the code is yours', () => {
    for (const token of [undefined, '', 'short', 'Z'.repeat(32), 5]) expect(() => parseHeartbeat({ code: 'ABC234', token, x: 1, y: 1, facing: 'up' })).toThrow(/token/);
  });
  it('rejects bad numbers, facings, looks and emotes', () => {
    expect(() => hb('ABC234', { x: 'a' })).toThrow(/x must/);
    expect(() => hb('ABC234', { y: NaN })).toThrow(/y must/);
    expect(() => hb('ABC234', { facing: 'sideways' })).toThrow(/facing/);
    expect(() => hb('ABC234', { emote: 'dance' })).toThrow(/emote/);
    expect(() => hb('ABC234', { look: 'x9' })).toThrow(/look/);
  });
  it('accepts one of the ten looks', () => {
    expect(hb('ABC234', { look: 'm4' }).look).toBe('m4');
    expect(hb('ABC234', { look: null }).look).toBeUndefined();
  });
  it('the alphabet matches the client codes (no O, I, L, 0, 1)', () => {
    expect(CODE_ALPHABET).not.toMatch(/[OIL01]/);
    expect(CODE_ALPHABET).toHaveLength(31);
  });
});

describe('heartbeat', () => {
  it('shows each visitor to the other, never to themselves, and counts everyone', async () => {
    await heartbeat(hb('AAAAAA', { x: 10 }), at(0));
    const r = await heartbeat(hb('BBBBBB', { x: 20, token: OTHER }), at(1));
    expect(r.count).toBe(2);
    expect(r.visitors.map(v => v.code)).toEqual(['AAAAAA']);
    expect(r.visitors[0]).toMatchObject({ x: 10, y: 300, facing: 'down', look: null, emote: null, emoteSeq: 0 });
    expect((await heartbeat(hb('AAAAAA', { x: 11 }), at(2))).visitors.map(v => v.code)).toEqual(['BBBBBB']);
  });
  it('shows the look a visitor picked', async () => {
    await heartbeat(hb('AAAAAA', { look: 'f3' }), at(0));
    expect((await heartbeat(hb('BBBBBB', { token: OTHER }), at(1))).visitors[0].look).toBe('f3');
  });
  it('a code belongs to the first browser that uses it', async () => {
    await heartbeat(hb('AAAAAA'), at(0));
    await expect(heartbeat(hb('AAAAAA', { token: OTHER }), at(1))).rejects.toMatchObject({ status: 409, message: 'Code already taken.' });
    expect((await heartbeat(hb('AAAAAA'), at(2))).count).toBe(1);
  });
  it('updates a visitor in place instead of adding rows', async () => {
    for (let i = 0; i < 3; i++) await heartbeat(hb('AAAAAA', { x: i * 10 }), at(i));
    const rows = await (await getTestDb()).select().from(fairVisitors);
    expect(rows).toHaveLength(1);
    expect(rows[0].x).toBe(20);
  });
  it('drops visitors who have not been heard from recently, and deletes old rows', async () => {
    await heartbeat(hb('AAAAAA'), at(0));
    const later = await heartbeat(hb('BBBBBB', { token: OTHER }), at(ACTIVE_MS / 1000 + 1));
    expect(later.visitors).toEqual([]);
    expect(later.count).toBe(1);
    await heartbeat(hb('BBBBBB', { token: OTHER }), at(KEEP_MS / 1000 + 5));
    expect(await (await getTestDb()).select().from(fairVisitors).where(eq(fairVisitors.code, 'AAAAAA'))).toEqual([]);
  });
  it('an emote bumps the counter once and later plain heartbeats keep it', async () => {
    await heartbeat(hb('AAAAAA', { emote: 'wave' }), at(0));
    let seen = (await heartbeat(hb('BBBBBB', { token: OTHER }), at(1))).visitors[0];
    expect(seen).toMatchObject({ emote: 'wave', emoteSeq: 1 });
    await heartbeat(hb('AAAAAA'), at(2));
    seen = (await heartbeat(hb('BBBBBB', { token: OTHER }), at(3))).visitors[0];
    expect(seen).toMatchObject({ emote: 'wave', emoteSeq: 1 });
    await heartbeat(hb('AAAAAA', { emote: 'namaste' }), at(4));
    seen = (await heartbeat(hb('BBBBBB', { token: OTHER }), at(5))).visitors[0];
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

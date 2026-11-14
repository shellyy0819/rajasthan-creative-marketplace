import { describe, it, expect, beforeEach } from 'vitest';
import { CODE_TTL_MS, CODE_TAKEN, claimCode, hashToken, parseClaim } from '@/lib/fair-codes';
import { fairCodes } from '@/db/schema';
import { getTestDb, resetTestDb } from './helpers/testdb';

const A = 'a'.repeat(32), B = 'b'.repeat(32), T0 = new Date('2026-11-12T10:00:00Z');
beforeEach(async () => { await resetTestDb(); });

describe('parseClaim', () => {
  it('needs a valid code and a secret', () => {
    expect(parseClaim({ code: 'ABC234', token: A })).toEqual({ code: 'ABC234', token: A });
    expect(() => parseClaim({ code: 'abc234', token: A })).toThrow(/code/);
    expect(() => parseClaim({ code: 'ABC234' })).toThrow(/token/);
    expect(() => parseClaim({ code: 'ABC234', token: 'xyz' })).toThrow(/token/);
  });
});

describe('claimCode', () => {
  it('gives a free code to the first asker and keeps it theirs', async () => {
    expect(await claimCode({ code: 'ABC234', token: A }, T0)).toBe('ok');
    expect(await claimCode({ code: 'ABC234', token: A }, T0)).toBe('ok');
    expect(await claimCode({ code: 'ABC234', token: B }, T0)).toBe('taken');
    expect(CODE_TAKEN).toBe('Code already taken.');
  });
  it('different codes do not get in each other\'s way', async () => {
    expect(await claimCode({ code: 'AAAAAA', token: A }, T0)).toBe('ok');
    expect(await claimCode({ code: 'BBBBBB', token: B }, T0)).toBe('ok');
  });
  it('stores only a hash of the secret', async () => {
    await claimCode({ code: 'ABC234', token: A }, T0);
    const rows = await (await getTestDb()).select().from(fairCodes);
    expect(rows).toEqual([expect.objectContaining({ code: 'ABC234', tokenHash: hashToken(A) })]);
    expect(JSON.stringify(rows)).not.toContain(A);
    expect(hashToken(A)).toHaveLength(64);
  });
  it('lets two people choosing the same code at the same moment only one win', async () => {
    const results = await Promise.all([claimCode({ code: 'RACE23', token: A }, T0), claimCode({ code: 'RACE23', token: B }, T0)]);
    expect(results.filter(r => r === 'ok')).toHaveLength(1);
    expect(results.filter(r => r === 'taken')).toHaveLength(1);
  });
  it('releases a code nobody has used for 30 days, and keeps one that is used', async () => {
    await claimCode({ code: 'ABC234', token: A }, T0);
    expect(await claimCode({ code: 'ABC234', token: B }, new Date(T0.getTime() + CODE_TTL_MS - 1000))).toBe('taken');
    expect(await claimCode({ code: 'ABC234', token: A }, new Date(T0.getTime() + CODE_TTL_MS - 1000))).toBe('ok'); // using it refreshes it
    expect(await claimCode({ code: 'ABC234', token: B }, new Date(T0.getTime() + 2 * CODE_TTL_MS))).toBe('ok');
    expect(await claimCode({ code: 'ABC234', token: A }, new Date(T0.getTime() + 2 * CODE_TTL_MS + 1000))).toBe('taken');
  });
});

import { createHmac } from 'node:crypto';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { signCityRef, verifyCityRef, type CityPick } from '@/lib/city-ref';
import { ApiError } from '@/lib/errors';

const pick: CityPick = { osmType: 'R', osmId: 123, name: 'Udaipur', state: 'Rajasthan', lat: 24.58, lng: 73.68 };
const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => vi.stubEnv('NEXTAUTH_SECRET', 'test-secret'));
afterEach(() => vi.unstubAllEnvs());

const invalid = (fn: () => unknown) => {
  try { fn(); } catch (e) { expect(e).toBeInstanceOf(ApiError); expect((e as ApiError).status).toBe(400); expect((e as ApiError).message).toBe('Invalid city selection.'); return; }
  throw new Error('did not throw');
};

describe('city refs', () => {
  it('round-trips a valid pick', () => {
    expect(verifyCityRef(signCityRef(pick, NOW), NOW + 1000)).toEqual(pick);
  });
  it('rejects a tampered payload', () => {
    const [payload, sig] = signCityRef(pick, NOW).split('.');
    const forged = Buffer.from(JSON.stringify({ ...pick, name: 'Evil' })).toString('base64url');
    invalid(() => verifyCityRef(`${forged}.${sig}`, NOW));
    invalid(() => verifyCityRef(`${payload}.${sig}x`, NOW));
    invalid(() => verifyCityRef(payload, NOW));
  });
  it('rejects an expired ref', () => {
    const ref = signCityRef(pick, NOW);
    expect(verifyCityRef(ref, NOW + DAY - 1)).toEqual(pick);
    invalid(() => verifyCityRef(ref, NOW + DAY + 1));
  });
  it('rejects a non-string', () => {
    for (const v of [undefined, null, 42, {}, ['a.b']]) invalid(() => verifyCityRef(v, NOW));
  });
  it('rejects a ref signed with another secret', () => {
    const ref = signCityRef(pick, NOW);
    vi.stubEnv('NEXTAUTH_SECRET', 'other');
    invalid(() => verifyCityRef(ref, NOW));
  });
  it('throws when the secret is unset', () => {
    vi.stubEnv('NEXTAUTH_SECRET', '');
    expect(() => signCityRef(pick, NOW)).toThrow(/NEXTAUTH_SECRET/);
    expect(() => verifyCityRef('a.b', NOW)).toThrow(/NEXTAUTH_SECRET/);
  });

  describe('signed but malformed payloads', () => {
    const raw = (payload: string) => `${payload}.${createHmac('sha256', 'test-secret').update(payload).digest('base64url')}`;
    const obj = (o: unknown) => raw(Buffer.from(JSON.stringify(o)).toString('base64url'));
    const good = { ...pick, exp: NOW + DAY };
    it('accepts the baseline', () => expect(verifyCityRef(obj(good), NOW)).toEqual(pick));
    it('rejects bad JSON, non-objects and bad base64', () => {
      invalid(() => verifyCityRef(raw(Buffer.from('{nope').toString('base64url')), NOW));
      for (const v of [null, 5, 'x', [1]]) invalid(() => verifyCityRef(obj(v), NOW));
      invalid(() => verifyCityRef(raw('!!!'), NOW));
      invalid(() => verifyCityRef('nodot', NOW));
      invalid(() => verifyCityRef('a.b.c', NOW));
      invalid(() => verifyCityRef('.', NOW));
    });
    it('rejects wrong field types and missing exp', () => {
      for (const bad of [{ osmType: 1 }, { osmId: '1' }, { name: 5 }, { lat: '1' }, { lng: null }, { state: 3 }, { exp: '9' }, { exp: undefined }])
        invalid(() => verifyCityRef(obj({ ...good, ...bad }), NOW));
    });
    it('rejects out-of-range or odd values', () => {
      for (const bad of [{ lat: 91 }, { lat: -91 }, { lng: 181 }, { lng: -181 }, { name: '' }, { name: '   ' }, { name: 'x'.repeat(201) },
        { state: 'x'.repeat(101) }, { osmId: 1.5 }])
        invalid(() => verifyCityRef(obj({ ...good, ...bad }), NOW));
    });
  });
});

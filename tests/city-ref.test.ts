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
});

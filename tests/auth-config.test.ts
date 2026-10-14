import { describe, it, expect, afterEach } from 'vitest';
import { auth, authOptions } from '@/auth';

describe('auth fails closed without NEXTAUTH_SECRET', () => {
  const orig = process.env.NEXTAUTH_SECRET;
  afterEach(() => {
    if (orig === undefined) delete process.env.NEXTAUTH_SECRET; else process.env.NEXTAUTH_SECRET = orig;
  });
  it('auth() throws instead of using next-auth\'s guessable dev secret', async () => {
    delete process.env.NEXTAUTH_SECRET;
    await expect(auth()).rejects.toThrow(/NEXTAUTH_SECRET/);
  });
  it('authOptions.secret is the env secret so route handler and getServerSession agree', () => {
    process.env.NEXTAUTH_SECRET = 'abc';
    expect(authOptions.secret).toBe('abc');
  });
});

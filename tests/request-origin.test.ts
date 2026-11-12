import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { originFromRequest } from '@/lib/request-origin';

const env = { NEXT_PUBLIC_SITE_URL: 'https://api.craftofy.online', DASHBOARD_URL: 'https://dashboard.craftofy.online' };
describe('originFromRequest', () => {
  const orig = process.env.NEXT_PUBLIC_SITE_URL;
  beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = env.NEXT_PUBLIC_SITE_URL; });
  afterEach(() => { if (orig === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = orig; });
  it('uses the request host over a wrong NEXT_PUBLIC_SITE_URL', () => {
    expect(originFromRequest('craftofy.online', 'https', env)).toBe('https://craftofy.online');
    expect(originFromRequest('craftofy.online:443, other', 'http', env)).toBe('https://craftofy.online');
  });
  it('falls back to the configured site for a missing, malformed or dashboard host', () => {
    expect(originFromRequest(null, null, env)).toBe('https://api.craftofy.online');
    expect(originFromRequest('bad host/x', 'https', env)).toBe('https://api.craftofy.online');
    expect(originFromRequest('dashboard.craftofy.online', 'https', env)).toBe('https://api.craftofy.online');
  });
  it('keeps http and the port for localhost only', () => {
    expect(originFromRequest('localhost:3000', null, env)).toBe('http://localhost:3000');
    expect(originFromRequest('localhost:3000', 'https', env)).toBe('https://localhost:3000');
  });
});

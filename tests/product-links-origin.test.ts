import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicOrigin } from '@/lib/public-origin';

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
afterEach(() => vi.unstubAllEnvs());

describe('publicOrigin: the address used in links inside emails', () => {
  it('uses the configured site address when it is a real one', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://craftofy.online');
    expect(publicOrigin(h({ host: 'something.else' }))).toBe('https://craftofy.online');
  });
  it('when the site address is only the local default, uses the host the request came in on', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(publicOrigin(h({ host: 'craftofy.online', 'x-forwarded-proto': 'https' }))).toBe('https://craftofy.online');
    expect(publicOrigin(h({ host: 'internal:3000', 'x-forwarded-host': 'craftofy.online', 'x-forwarded-proto': 'https' }))).toBe('https://craftofy.online');
  });
  it('stays on localhost when the request itself is local, and ignores odd hosts', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(publicOrigin(h({ host: 'localhost:3000' }))).toBe('http://localhost:3000');
    expect(publicOrigin(h({ host: 'evil.com/path?x' }))).toBe('http://localhost:3000');
    expect(publicOrigin(h({}))).toBe('http://localhost:3000');
  });
});

describe('browser components never work out the site address themselves', () => {
  it('no "use client" component imports abs() or siteUrl(): the browser bundle may not know the address (NEXT_PUBLIC_ values are fixed at build time), so a live page could show localhost', () => {
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []);
    const offenders = walk('src').filter(f => {
      const s = fs.readFileSync(f, 'utf8');
      return /^['"]use client['"]/.test(s) && /import\s*\{[^}]*\b(abs|siteUrl)\b[^}]*\}\s*from\s*['"](@\/lib\/site|\.\.?\/.*site)['"]/.test(s);
    });
    expect(offenders).toEqual([]);
  });
});

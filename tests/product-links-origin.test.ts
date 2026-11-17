import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestOrigin } from '@/lib/public-origin';

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

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
afterEach(() => vi.unstubAllEnvs());

describe('requestOrigin: the mail link uses the host the buyer was on, but only Craftofy\'s own domain', () => {
  it('uses the browser Origin first, then Referer, then the forwarded host, then Host', () => {
    expect(requestOrigin(h({ origin: 'https://craftofy.online', host: 'api.craftofy.online' }))).toBe('https://craftofy.online');
    expect(requestOrigin(h({ referer: 'https://www.craftofy.online/products/x-p1', host: 'api.craftofy.online' }))).toBe('https://www.craftofy.online');
    expect(requestOrigin(h({ 'x-forwarded-host': 'craftofy.online, other', host: 'internal' }))).toBe('https://craftofy.online');
    expect(requestOrigin(h({ host: 'api.craftofy.online' }))).toBe('https://api.craftofy.online');
  });
  it('is always https for Craftofy hosts, and http for localhost (development)', () => {
    expect(requestOrigin(h({ origin: 'http://craftofy.online' }))).toBe('https://craftofy.online');
    expect(requestOrigin(h({ host: 'localhost:3000' }))).toBe('http://localhost:3000');
  });
  it('refuses any other host, including look-alikes, so a forged header cannot redirect the link', () => {
    for (const bad of ['other.craftofy.online', 'craftofy.online:8080', 'www.craftofy.online:443', 'evil.example', 'craftofy.online.evil.example', 'notcraftofy.online', 'craftofy.online@evil.example', 'craftofy.online:80@evil', 'evil.example/craftofy.online', 'xcraftofy.online']) {
      expect(requestOrigin(h({ origin: `https://${bad}`, host: bad, 'x-forwarded-host': bad }))).toBeNull();
    }
    expect(requestOrigin(h({}))).toBeNull();
  });
  it('skips a refused value and keeps looking: a forged Origin does not stop a genuine Host being used', () => {
    expect(requestOrigin(h({ origin: 'https://evil.example', host: 'craftofy.online' }))).toBe('https://craftofy.online');
  });
  it('localhost is accepted for development but never in production', () => {
    expect(requestOrigin(h({ host: 'localhost:3000' }))).toBe('http://localhost:3000');
    vi.stubEnv('NODE_ENV', 'production');
    expect(requestOrigin(h({ host: 'localhost:3000' }))).toBeNull();
    expect(requestOrigin(h({ origin: 'http://127.0.0.1:3000' }))).toBeNull();
    expect(requestOrigin(h({ origin: 'https://craftofy.online' }))).toBe('https://craftofy.online');
  });
});

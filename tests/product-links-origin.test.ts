import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('browser components never work out the site address themselves', () => {
  it('no "use client" component imports abs() or siteUrl(): the browser bundle may not know the address (NEXT_PUBLIC_ values are fixed at build time), so a live page could show localhost', () => {
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []);
    const offenders = walk('src').filter(f => {
      const s = fs.readFileSync(f, 'utf8');
      return /^['"]use client['"]/.test(s) && /import\s*\{[^}]*\b(abs|siteUrl)\b[^}]*\}\s*from\s*['"](@\/lib\/site|\.\.?\/.*site)['"]/.test(s);
    });
    expect(offenders).toEqual([]);
  });
  it('the mail link is built from the configured site address only, never from request headers (a forged Host header must not decide where a Craftofy email points)', () => {
    const lib = fs.readFileSync('src/lib/product-enquiry.ts', 'utf8');
    const route = fs.readFileSync('src/app/api/products/[id]/enquiry/route.ts', 'utf8');
    expect(lib).toContain("abs(`/products/${productSlug(p)}`)");
    expect(route).not.toMatch(/x-forwarded-host|headers\.get\(['"]host['"]\)|publicOrigin/i);
  });
});

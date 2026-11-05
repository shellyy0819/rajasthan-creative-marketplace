import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// The marketplace must only ever show data that comes from the API/database. The sample catalogue used by the
// tests lives in tests/fixtures; nothing the app ships may contain or seed it.
const SAMPLE_NAMES = [
  'Crochet Lily Bouquet', 'Pichola Boat Bag Charm', 'Pressed Flower Resin Coaster Set', 'Blue Pottery Trinket Dish',
  'Beginner Crochet: Make Your First Flower', 'Paint a Miniature Tote Bag', 'Sunday Makers Meetup',
  'Shauk and Stuff', 'Lake City Knots', 'Petal & Pour', 'Neel Mitti Studio', 'Katha Makers', 'Marwar Creative Circle',
];
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? (['node_modules', '.next'].includes(e.name) ? [] : walk(p)) : [p];
});

describe('no dummy data ships with the app', () => {
  it('data/db.json (the seed source) has no products, workshops, orders or bookings', () => {
    const d = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
    for (const k of ['products', 'workshops', 'orders', 'bookings']) expect(d[k] ?? []).toEqual([]);
  });
  it('no source, script, public asset or migration contains sample catalogue names', () => {
    const files = [...walk('src'), ...walk('scripts'), ...walk('public'), ...walk('drizzle')].filter(f => /\.(ts|tsx|mjs|js|json|sql|css|html|md)$/.test(f));
    const hits = files.flatMap(f => { const t = fs.readFileSync(f, 'utf8'); return SAMPLE_NAMES.filter(n => t.includes(n)).map(n => `${f}: ${n}`); });
    expect(hits).toEqual([]);
  });
  it('the seed CLI imports only data/db.json, never the test fixtures', () => {
    const t = fs.readFileSync('scripts/db-seed.ts', 'utf8');
    expect(t).toContain('data/db.json');
    expect(t).not.toContain('fixtures');
  });
  const shipped = () => [...walk('src')].filter(f => /\.(ts|tsx|css)$/.test(f));
  it('no placeholder email address (.example / .invalid) is written into the app code', () => {
    const hits = shipped().flatMap(f => (fs.readFileSync(f, 'utf8').match(/[\w.+-]+@[\w-]+\.(example|invalid)\b/g) ?? []).map(m => `${f}: ${m}`))
      .filter(h => !/src\/db\/seed\.ts/.test(h)); // the seed's internal placeholder owners are not shown anywhere
    expect(hits).toEqual([]);
  });
  it('visitors never read the word "demo" in the app (internal status codes like DEMO_ORDER_CREATED are not shown)', () => {
    const hits = shipped().flatMap(f => fs.readFileSync(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l] as const)
      .filter(([, , l]) => /\bdemo\b/i.test(l)).map(([f2, n, l]) => `${f2}:${n}: ${l.trim().slice(0, 90)}`));
    expect(hits).toEqual([]);
  });
  it('the hero illustration carries no made-up event or stall details', () => {
    const t = fs.readFileSync('src/components/HeroStall.tsx', 'utf8');
    for (const s of ['Stall 12', 'LIVE TODAY', 'Block printing', 'free to try', '4 pm']) expect(t, s).not.toContain(s);
  });
});

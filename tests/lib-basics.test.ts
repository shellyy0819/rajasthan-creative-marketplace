import { describe, it, expect, afterEach } from 'vitest';
import { money } from '@/lib/money';
import { slugify } from '@/lib/slug';
import { formatDay, truncate } from '@/lib/format';
import { siteUrl, abs } from '@/lib/site';

describe('money', () => {
  it('formats paise as INR with no decimals', () => {
    expect(money(85000)).toBe('₹850');
    expect(money(0)).toBe('₹0');
  });
});

describe('slugify', () => {
  it('lowercases, replaces & and punctuation, trims dashes', () => {
    expect(slugify('Pressed Flower Resin Coaster Set')).toBe('pressed-flower-resin-coaster-set');
    expect(slugify('Crochet & Textiles!')).toBe('crochet-and-textiles');
    expect(slugify('  --Hi--  ')).toBe('hi');
  });
});

describe('format', () => {
  it('formatDay uses IST regardless of server tz', () => {
    expect(formatDay('2026-11-08')).toEqual({ day: 8, month: 'Nov', year: 2026 });
  });
  it('truncate adds ellipsis only when needed', () => {
    expect(truncate('abc', 5)).toBe('abc');
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });
});

describe('site', () => {
  const orig = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => {
    if (orig === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = orig;
  });
  it('strips trailing slashes and builds absolute urls', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com//';
    expect(siteUrl()).toBe('https://example.com');
    expect(abs('/shop')).toBe('https://example.com/shop');
    expect(abs('shop')).toBe('https://example.com/shop');
  });
  it('upgrades a non-local http url to https but leaves localhost alone', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://api.craftofy.online';
    expect(abs('/shop')).toBe('https://api.craftofy.online/shop');
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3001';
    expect(siteUrl()).toBe('http://localhost:3001');
    process.env.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3000';
    expect(siteUrl()).toBe('http://127.0.0.1:3000');
  });
  it('defaults to localhost', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe('http://localhost:3000');
  });
});

describe('formatDay year', () => {
  it('returns the year from the date, not a hardcoded one', () => {
    expect(formatDay('2027-01-10')).toEqual({ day: 10, month: 'Jan', year: 2027 });
  });
});

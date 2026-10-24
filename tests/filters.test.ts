import { describe, it, expect } from 'vitest';
import { parseFilters, hasFilters } from '@/lib/filters';

describe('parseFilters', () => {
  it('returns empty for no params', () => {
    expect(parseFilters({})).toEqual({});
    expect(hasFilters(parseFilters({}))).toBe(false);
  });
  it('accepts known city/category/type', () => {
    expect(parseFilters({ city: 'Jaipur', category: 'Pottery', type: 'FREE' }))
      .toEqual({ city: 'Jaipur', category: 'Pottery', type: 'FREE' });
  });
  it('accepts any non-empty city up to 100 chars (cities are data, not a whitelist)', () => {
    expect(parseFilters({ city: 'Kota' })).toEqual({ city: 'Kota' });
    expect(parseFilters({ city: '  ' })).toEqual({});
    expect(parseFilters({ city: 'y'.repeat(101) })).toEqual({});
  });
  it('drops unknown type; categories are user-created so any sane name is kept (an unknown one just finds nothing)', () => {
    expect(parseFilters({ category: 'x', type: 'weird' })).toEqual({ category: 'x' });
    expect(parseFilters({ category: 'Wooden Toys' })).toEqual({ category: 'Wooden Toys' });
    expect(parseFilters({ category: ' ' })).toEqual({});
    expect(parseFilters({ category: 'y'.repeat(61) })).toEqual({});
  });
  it('uses first value of repeated params', () => {
    expect(parseFilters({ city: ['Jaipur', 'Udaipur'] })).toEqual({ city: 'Jaipur' });
  });
  it('treats "All India" as no filter', () => {
    expect(parseFilters({ city: 'All India' })).toEqual({});
  });
  it('trims q and caps length at 100', () => {
    expect(parseFilters({ q: '  hi  ' })).toEqual({ q: 'hi' });
    expect(parseFilters({ q: 'a'.repeat(10000) }).q).toHaveLength(100);
    expect(parseFilters({ q: '   ' })).toEqual({});
  });
});

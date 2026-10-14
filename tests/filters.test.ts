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
  it('drops unknown city/category/type', () => {
    expect(parseFilters({ city: 'Mars', category: 'x', type: 'weird' })).toEqual({});
  });
  it('uses first value of repeated params', () => {
    expect(parseFilters({ city: ['Jaipur', 'Udaipur'] })).toEqual({ city: 'Jaipur' });
  });
  it('treats "All Rajasthan" as no filter', () => {
    expect(parseFilters({ city: 'All Rajasthan' })).toEqual({});
  });
  it('trims q and caps length at 100', () => {
    expect(parseFilters({ q: '  hi  ' })).toEqual({ q: 'hi' });
    expect(parseFilters({ q: 'a'.repeat(10000) }).q).toHaveLength(100);
    expect(parseFilters({ q: '   ' })).toEqual({});
  });
});

import { describe, it, expect } from 'vitest';
import { diwaliOver } from '@/lib/fair-festival';

describe('diwaliOver', () => {
  it('keeps the diyas up before and on Diwali and for two days after', () => {
    expect(diwaliOver(new Date('2026-11-01T10:00:00+05:30'))).toBe(false);
    expect(diwaliOver(new Date('2026-11-08T23:30:00+05:30'))).toBe(false);
    expect(diwaliOver(new Date('2026-11-10T23:30:00+05:30'))).toBe(false);
  });
  it('puts them away once Diwali is in the past', () => {
    expect(diwaliOver(new Date('2026-11-11T00:10:00+05:30'))).toBe(true);
    expect(diwaliOver(new Date('2026-12-25T10:00:00+05:30'))).toBe(true);
  });
  it('uses the Indian date, not UTC', () => {
    expect(diwaliOver(new Date('2026-11-10T20:00:00Z'))).toBe(true);   // 01:30 IST on the 11th
  });
  it('keeps them for a year that is not listed', () => {
    expect(diwaliOver(new Date('2035-06-01T10:00:00+05:30'))).toBe(false);
  });
});

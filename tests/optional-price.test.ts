import { describe, it, expect } from 'vitest';
import { money } from '@/lib/money';
import { optionalInt } from '@/lib/validate';
import { buildPayload } from '@/components/PostForm';

describe('optional product price', () => {
  it('money shows "Price on request" when there is no price, and still formats 0', () => {
    expect(money(null)).toBe('Price on request');
    expect(money(undefined)).toBe('Price on request');
    expect(money(0)).toMatch(/0/);
    expect(money(12000)).toMatch(/120/);
  });
  it('optionalInt maps blank/null/undefined to null and still validates real values', () => {
    expect(optionalInt(undefined, 'pricePaise', 0, 100)).toBeNull();
    expect(optionalInt(null, 'pricePaise', 0, 100)).toBeNull();
    expect(optionalInt('', 'pricePaise', 0, 100)).toBeNull();
    expect(optionalInt(0, 'pricePaise', 0, 100)).toBe(0);
    expect(() => optionalInt(-1, 'pricePaise', 0, 100)).toThrow();
    expect(() => optionalInt(1.5, 'pricePaise', 0, 100)).toThrow();
  });
  it('the post form sends a null price when the field is left blank', () => {
    const f = new FormData();
    f.set('name', 'x'); f.set('price', ''); f.set('stock', '2');
    expect(buildPayload(f).pricePaise).toBeNull();
    f.set('price', '12.5');
    expect(buildPayload(f).pricePaise).toBe(1250);
  });
});

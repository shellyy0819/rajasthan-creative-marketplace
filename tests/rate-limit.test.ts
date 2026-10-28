import { describe, it, expect } from 'vitest';
import { createLimiter } from '@/lib/rate-limit';

describe('createLimiter', () => {
  it('allows max hits per window per key, then blocks, then recovers when the window passes', () => {
    const l = createLimiter(3, 1000);
    expect([1, 2, 3, 4].map(() => l.hit('a', 0))).toEqual([true, true, true, false]);
    expect(l.hit('b', 0)).toBe(true);                 // other keys are independent
    expect(l.hit('a', 999)).toBe(false);
    expect(l.hit('a', 1001)).toBe(true);
  });
  it('blocked attempts do not extend the block, and memory stays bounded for many keys', () => {
    const l = createLimiter(1, 1000);
    l.hit('a', 0); for (let i = 0; i < 50; i++) l.hit('a', 500);
    expect(l.hit('a', 1001)).toBe(true);
    for (let i = 0; i < 20_000; i++) l.hit(`k${i}`, 2000);
    expect(l.size()).toBeLessThanOrEqual(10_000);
  });
});

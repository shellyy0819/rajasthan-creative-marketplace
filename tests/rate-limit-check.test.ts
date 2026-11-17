import { describe, it, expect } from 'vitest';
import { createLimiter } from '@/lib/rate-limit';

describe('limiter.check', () => {
  it('reports whether a hit would pass without spending it', () => {
    const l = createLimiter(2, 1000);
    for (let i = 0; i < 5; i++) expect(l.check('k', 0)).toBe(true);
    expect(l.hit('k', 0)).toBe(true); expect(l.hit('k', 0)).toBe(true);
    expect(l.check('k', 0)).toBe(false);
    expect(l.hit('k', 0)).toBe(false);
    expect(l.check('k', 2000)).toBe(true); // window passed
  });
});

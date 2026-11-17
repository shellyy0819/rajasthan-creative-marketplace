import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('product page like prompt (source contract)', () => {
  it('asks the buyer to like the product, right above the like button', () => {
    const src = fs.readFileSync('src/app/products/[slug]/page.tsx', 'utf8');
    const i = src.indexOf('If you really liked the product, give it a like');
    expect(i).toBeGreaterThan(-1);
    expect(src.indexOf('<LikeButton')).toBeGreaterThan(i);
    expect(src.indexOf('<LikeButton') - i).toBeLessThan(200);
  });
});

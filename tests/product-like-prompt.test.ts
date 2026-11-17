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

describe('product page place (source contract)', () => {
  it('shows City, State, Country: the city links to its page, the state is skipped when unknown, the country is India', () => {
    const src = fs.readFileSync('src/app/products/[slug]/page.tsx', 'utf8');
    expect(src).toContain('{p.cityState ? `, ${p.cityState}` : ""}, India');
    expect(src).toContain('<Link href={`/cities/${p.citySlug}`}>{p.city}</Link>');
  });
});

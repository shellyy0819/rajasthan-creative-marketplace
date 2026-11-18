import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CategoryIcon, categoryIconKind } from '@/components/CategoryIcon';

describe('categoryIconKind', () => {
  it.each([
    ['Pottery', 'pot'], ['Resin Art', 'resin'], ['Crochet', 'crochet'], ['Crochet & Textiles', 'crochet'], ['Jewellery', 'bangle'],
    ['Bakery and confectionery', 'cake'], ['Wooden Crafts', 'wood'], ['Paintings', 'painting'], ['Home Decor Products', 'decor'],
    ['Handloom', 'cloth'], ['Accessories', 'pouch'], ['Leather Goods', 'pouch'], ['Something New', 'flower'], ['', 'flower'],
  ])('%s gets the %s picture', (name, kind) => expect(categoryIconKind(name)).toBe(kind));
  it('Resin Art is resin, not a painting, and Wooden Crafts is wood, not decor', () => {
    expect(categoryIconKind('Resin Art')).toBe('resin');
    expect(categoryIconKind('Wooden Home Decor')).toBe('wood');
  });
});

describe('CategoryIcon', () => {
  it('is a decorative svg (hidden from screen readers) of the right kind, with a larger variant', () => {
    const small = renderToStaticMarkup(<CategoryIcon name="Pottery" />);
    expect(small).toMatch(/<svg class="cat-ic" data-kind="pot"[^>]*aria-hidden="true"/);
    expect(renderToStaticMarkup(<CategoryIcon name="Pottery" large />)).toContain('class="cat-ic cat-ic-lg"');
  });
  it('uses only the stall\'s colour classes: no hard-coded colours or font names', () => {
    for (const n of ['Pottery', 'Crochet', 'Handloom', 'Resin Art', 'Jewellery', 'Accessories', 'Home Decor', 'Bakery', 'Wooden Crafts', 'Paintings', 'Other']) {
      const h = renderToStaticMarkup(<CategoryIcon name={n} />);
      expect(h).not.toMatch(/fill="#|stroke="#|style=|font/i);
    }
  });
});

// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import { STICKERS, type StickerId } from '@/lib/themes/stickers';
import { STICKER_ART } from '@/components/theme/art';
import { StickerLayer } from '@/components/theme/StickerLayer';

const IDS = (Object.keys(STICKERS) as StickerId[]).filter((id) => ['dhanteras', 'diwali', 'christmas'].includes(STICKERS[id].set));
const css = fs.readFileSync('src/app/globals.css', 'utf8');
const svg = (inner: string) => { const d = document.createElement('div'); d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`; return d.querySelector('svg')!; };

describe('sticker art', () => {
  it('covers all 20 ids', () => { expect(IDS).toHaveLength(20); });
  it.each(IDS)('%s renders a non-empty drawing with no unsafe elements', (id) => {
    const Art = STICKER_ART[id]!;
    expect(Art).toBeTypeOf('function');
    const html = renderToStaticMarkup(<svg><Art /></svg>);
    expect(svg(html.replace(/^<svg>|<\/svg>$/g, '')).children.length).toBeGreaterThan(0);
    expect(html).not.toMatch(/<script|<foreignObject|<text/i);
  });
  it('StickerLayer renders all 20 at once with no duplicate ids', () => {
    const html = renderToStaticMarkup(<svg><StickerLayer placements={IDS.map((id) => ({ id, x: 0, y: 0, s: 1 }))} /></svg>);
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(html).toContain('aria-hidden="true"');
    expect((html.match(/<use /g) ?? []).length).toBe(8);
    expect(html).not.toMatch(/<script|<foreignObject|<text/i);
  });
  it('declares the sticker tokens and disables flame and wave motion for reduced motion', () => {
    for (const t of ['clay', 'flame', 'flame2', 'marigold', 'marigold2', 'leaf', 'gold', 'red', 'pine', 'pine2', 'snow', 'ice']) expect(css).toContain(`--stk-${t}:`);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.flame, \.wave2 \{ animation: none; \}/);
  });
});

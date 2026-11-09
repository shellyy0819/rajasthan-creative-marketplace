// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PRESETS, isPresetKey } from '@/lib/themes/presets';
import { STICKERS, type StickerId } from '@/lib/themes/stickers';
import { STICKER_ART } from '@/components/theme/art';
import { StickerLayer } from '@/components/theme/StickerLayer';
import { LIMITS } from '@/lib/themes/types';
import { passesContrast, contrastRatio, onColor } from '@/lib/themes/contrast';

const KEYS = Object.keys(PRESETS) as (keyof typeof PRESETS)[];
const NEW = ['govardhan', 'bhaidooj', 'chhath', 'guru-nanak', 'thanksgiving'] as const;

describe('festive presets', () => {
  it('has all 9 preset keys', () => {
    expect([...KEYS].sort()).toEqual(['bhaidooj', 'chhath', 'christmas', 'dhanteras', 'diwali', 'everyday', 'govardhan', 'guru-nanak', 'thanksgiving']);
    for (const k of KEYS) expect(isPresetKey(k)).toBe(true);
  });
  it.each(KEYS)('%s primary meets 4.5:1 and matches --green', (k) => {
    const p = PRESETS[k];
    expect(passesContrast(p.primary)).toBe(true);
    expect(contrastRatio(p.primary, onColor(p.primary))).toBeGreaterThanOrEqual(4.5);
    expect(p.brand['--green']).toBe(p.primary);
  });
  it.each(KEYS)('%s wording is within LIMITS', (k) => {
    const c = PRESETS[k].config;
    for (const f of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) expect(c[f].length, f).toBeLessThanOrEqual(LIMITS[f]);
    expect(PRESETS[k].label.length).toBeGreaterThan(0);
  });
  it.each(KEYS)('%s placements exist in the catalogue with art', (k) => {
    const ids = PRESETS[k].config.stickers.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) { expect(STICKERS).toHaveProperty(id); expect(STICKER_ART[id as StickerId]).toBeTypeOf('function'); }
  });
  it.each(NEW)('%s has dates on its day (IST 06:00 to 23:59) and a sticker set', (k) => {
    const s = PRESETS[k].sample!;
    expect(s.startsAt).toMatch(/^2026-11-\d\dT06:00$/);
    expect(s.endsAt).toBe(`${s.startsAt.slice(0, 10)}T23:59`);
    expect(PRESETS[k].config.stickers.length).toBeGreaterThan(0);
  });
  it('catalogue ids are unique, every sticker has art, and new sets own stickers', () => {
    const ids = Object.keys(STICKERS) as StickerId[];
    for (const id of ids) expect(STICKER_ART[id], id).toBeTypeOf('function');
    for (const k of NEW) expect(ids.some((id) => STICKERS[id].set === k)).toBe(true);
  });
  it('every sticker renders aria-hidden markup without unsafe elements or duplicate ids', () => {
    const html = renderToStaticMarkup(<svg><StickerLayer placements={(Object.keys(STICKERS) as StickerId[]).map((id) => ({ id, x: 0, y: 0, s: 1 }))} /></svg>);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/<script|<foreignObject|<text/i);
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of Object.keys(STICKERS) as StickerId[]) {
      const one = renderToStaticMarkup(<svg><StickerLayer placements={[{ id, x: 0, y: 0, s: 1 }]} /></svg>);
      expect(one, id).toMatch(/^<svg><g aria-hidden="true">/);
      expect(one.length, id).toBeGreaterThan(200);
    }
  });
});

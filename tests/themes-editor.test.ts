import { describe, expect, it } from 'vitest';
import { addSticker, clampPlacement, effectivePrimary, haloOf, nudge, previewVars, primaryContrast, removeSticker, resize, stickerGroups } from '@/lib/themes/editor';
import { PRESETS } from '@/lib/themes/presets';
import { STICKERS } from '@/lib/themes/stickers';
import { validateConfig } from '@/lib/themes/validate';

describe('placement helpers', () => {
  it('clamps to the limits the server enforces', () => {
    expect(clampPlacement({ id: 'toran', x: 999, y: -999, s: 9 })).toEqual({ id: 'toran', x: 300, y: -300, s: 3 });
    expect(clampPlacement({ id: 'toran', x: 0, y: 0, s: 0.01 }).s).toBe(0.4);
  });
  it('moves and resizes without leaving valid ranges, and every result passes validateConfig', () => {
    let p = { id: 'toran', x: 0, y: 0, s: 1 };
    for (let i = 0; i < 200; i++) p = nudge(p, 16, -16);
    for (let i = 0; i < 100; i++) p = resize(p, 0.1);
    expect(p).toEqual({ id: 'toran', x: 300, y: -300, s: 3 });
    const cfg = { ...PRESETS.dhanteras.config, stickers: [p] };
    expect(() => validateConfig(cfg)).not.toThrow();
  });
  it('halo scales about the box centre', () => {
    const h = haloOf({ x: 100, y: 100, w: 40, h: 20 }, { id: 'toran', x: 10, y: 0, s: 2 });
    expect(h).toEqual({ x: 90, y: 90, w: 80, h: 40 });
  });
  it('add is idempotent, remove drops by id', () => {
    const one = addSticker([], 'toran');
    expect(addSticker(one, 'toran')).toHaveLength(1);
    expect(removeSticker(one, 'toran')).toEqual([]);
  });
});

describe('colour helpers', () => {
  it('reports contrast and rejects a low-contrast primary', () => {
    expect(primaryContrast('#6E1A2A').ok).toBe(true);
    expect(primaryContrast('#777777').ok).toBe(false);
    expect(primaryContrast('nope')).toEqual({ ratio: 0, ok: false, text: '' });
  });
  it('override wins over the preset primary and drives the preview vars', () => {
    expect(effectivePrimary('diwali', { ...PRESETS.diwali.config })).toBe(PRESETS.diwali.primary);
    const cfg = { ...PRESETS.diwali.config, primary: '#123456' };
    expect(effectivePrimary('diwali', cfg)).toBe('#123456');
    expect(previewVars('diwali', cfg)['--green']).toBe('#123456');
  });
});

describe('sticker picker', () => {
  it('groups every catalogue sticker exactly once', () => {
    const ids = stickerGroups().flatMap((g) => g.ids);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(Object.keys(STICKERS).sort());
  });
});

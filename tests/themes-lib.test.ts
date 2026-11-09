import { describe, it, expect } from 'vitest';
import { istToDate, dateToIst } from '@/lib/themes/ist';
import { contrastRatio, passesContrast, isHex } from '@/lib/themes/contrast';
import { PRESETS, EVERYDAY, isPresetKey } from '@/lib/themes/presets';
import { STICKERS, isStickerId } from '@/lib/themes/stickers';
import { validateConfig, validateWindow } from '@/lib/themes/validate';
import { themeCss } from '@/lib/themes/css';
import { pickLive, stateOf, renderThemeOf } from '@/lib/themes/resolve';
import { LIMITS, type Preset, type ThemeConfig, type ThemeRow } from '@/lib/themes/types';
import { ApiError } from '@/lib/errors';

const cfg = (over: Record<string, unknown> = {}) => ({ ...PRESETS.dhanteras.config, ...over });
const rejects = (raw: unknown, msg: RegExp) => {
  try { validateConfig(raw); } catch (e) { expect(e).toBeInstanceOf(ApiError); expect((e as ApiError).status).toBe(400); expect((e as ApiError).message).toMatch(msg); return; }
  throw new Error('expected rejection');
};

describe('ist', () => {
  it('parses IST wall time to the right instant and round-trips', () => {
    expect(istToDate('2026-11-07T00:00').toISOString()).toBe('2026-11-06T18:30:00.000Z');
    expect(dateToIst(istToDate('2026-11-07T00:00'))).toBe('2026-11-07T00:00');
    expect(dateToIst(istToDate('2026-12-25T23:59'))).toBe('2026-12-25T23:59');
  });
  it('throws on malformed input', () => {
    expect(() => istToDate('nope')).toThrow();
    expect(() => istToDate('2026-13-01T00:00')).toThrow();
    expect(() => istToDate('2026-11-07')).toThrow();
  });
});

describe('contrast', () => {
  it('computes ratios and the pass rule', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(passesContrast('#6E1A2A')).toBe(true);
    expect(passesContrast('#7F7F7F')).toBe(false);
  });
  it('isHex is strict', () => {
    expect(isHex('#6E1A2A')).toBe(true);
    expect(isHex('#fff')).toBe(false);
    expect(isHex('#fff;}body{display:none')).toBe(false);
    expect(isHex(5)).toBe(false);
  });
});

describe('validateConfig', () => {
  it('accepts every preset config', () => {
    for (const p of Object.values(PRESETS)) expect(validateConfig(p.config)).toEqual(p.config);
  });
  it('ignores unknown keys and trims text', () => {
    const out = validateConfig(cfg({ evil: 1, sign: '  Hello  ' }));
    expect(out.sign).toBe('Hello');
    expect('evil' in out).toBe(false);
  });
  it('rejects bad input with specific messages', () => {
    rejects(cfg({ stickers: [{ id: 'nope', x: 0, y: 0, s: 1 }] }), /sticker/i);
    rejects(cfg({ stickers: [{ id: 'toran', x: 301, y: 0, s: 1 }] }), /x must be between -300 and 300/);
    rejects(cfg({ stickers: [{ id: 'toran', x: 0, y: 0, s: 0.3 }] }), /scale/i);
    rejects(cfg({ stickers: [{ id: 'toran', x: 0, y: 0, s: 3.1 }] }), /scale/i);
    rejects(cfg({ banner: 'x'.repeat(61) }), /banner.*60/i);
    rejects(cfg({ sign: '   ' }), /sign/i);
    rejects(cfg({ primary: '#fff;}body{display:none' }), /primary/i);
    rejects(cfg({ primary: '#7F7F7F' }), /contrast/i);
    rejects(null, /object/i);
  });
});

describe('validateWindow', () => {
  it('accepts a good window', () => {
    const w = validateWindow('2026-11-07T00:00', '2026-11-08T00:00');
    expect(w.startsAt.toISOString()).toBe('2026-11-06T18:30:00.000Z');
  });
  it('rejects end <= start and malformed input', () => {
    expect(() => validateWindow('2026-11-07T00:00', '2026-11-07T00:00')).toThrow(/after/);
    expect(() => validateWindow('2026-11-08T00:00', '2026-11-07T00:00')).toThrow(/after/);
    expect(() => validateWindow('nope', '2026-11-07T00:00')).toThrow(ApiError);
    expect(() => validateWindow(undefined, undefined)).toThrow(ApiError);
  });
});

describe('themeCss', () => {
  it('emits palette rules for a festival', () => {
    const css = themeCss('dhanteras', PRESETS.dhanteras.config);
    expect(css).toContain('html:root[data-festival="dhanteras"]');
    expect(css).toContain('--green:#6E1A2A');
    expect(css).toContain('html:root[data-festival="dhanteras"][data-theme="light"]');
    expect(css).toContain('@media (prefers-color-scheme: light){html:root[data-festival="dhanteras"]:not([data-theme="dark"])');
    expect(css).toContain('--stall-board:');
  });
  it('keeps stall tokens out of the all-modes rule', () => {
    const css = themeCss('dhanteras', PRESETS.dhanteras.config);
    const first = css.slice(0, css.indexOf('}'));
    expect(first).not.toContain('--stall-');
    expect(first).toContain('--orange:');
  });
  it('rewrites green and on-green from a primary override', () => {
    const css = themeCss('dhanteras', { ...PRESETS.dhanteras.config, primary: '#112233' });
    expect(css).toContain('--green:#112233');
    expect(css).toContain('--on-green:#FFFFFF');
    expect(css).toContain('--green-d:#0E1B29');
  });
  it('everyday without override is empty, with override is not', () => {
    expect(themeCss('everyday', EVERYDAY.config)).toBe('');
    const css = themeCss('everyday', { ...EVERYDAY.config, primary: '#112233' });
    expect(css).toContain('html:root[data-festival="everyday"]');
    expect(css).toContain('--green:#112233');
  });
  it('never emits injected primary', () => {
    const css = themeCss('diwali', { ...PRESETS.diwali.config, primary: '#fff;}body{display:none' });
    expect(css).not.toContain('body{display:none');
    expect(css).toContain('--green:#7A1F5C');
  });
});

const row = (over: Partial<ThemeRow>): ThemeRow => ({
  id: 1, preset: 'diwali', status: 'scheduled', startsAt: istToDate('2026-11-07T00:00'), endsAt: istToDate('2026-11-08T00:00'),
  config: PRESETS.diwali.config, updatedAt: new Date(0), ...over,
});

describe('resolve', () => {
  const r = row({});
  it('start inclusive, end exclusive', () => {
    expect(pickLive([r], new Date('2026-11-06T18:30:00.000Z'))).toBe(r);
    expect(pickLive([r], new Date('2026-11-06T18:29:59.000Z'))).toBeUndefined();
    expect(pickLive([r], new Date('2026-11-07T18:30:00.000Z'))).toBeUndefined();
    expect(pickLive([r], new Date('2026-11-07T18:29:59.000Z'))).toBe(r);
  });
  it('later start wins, ties by higher id, drafts never win', () => {
    const a = row({ id: 1 });
    const b = row({ id: 2, startsAt: istToDate('2026-11-07T06:00') });
    const c = row({ id: 3, startsAt: istToDate('2026-11-07T06:00') });
    const d = row({ id: 4, status: 'draft', startsAt: istToDate('2026-11-07T12:00') });
    const now = istToDate('2026-11-07T13:00');
    expect(pickLive([a, b, d], now)).toBe(b);
    expect(pickLive([a, c, b, d], now)?.id).toBe(3);
    expect(pickLive([d], now)).toBeUndefined();
  });
  it('stateOf', () => {
    expect(stateOf(row({ status: 'draft' }), new Date())).toBe('draft');
    expect(stateOf(row({ status: 'base', startsAt: null, endsAt: null }), new Date())).toBe('base');
    expect(stateOf(r, new Date('2026-11-01T00:00:00Z'))).toBe('scheduled');
    expect(stateOf(r, new Date('2026-11-06T18:30:00Z'))).toBe('live');
    expect(stateOf(r, new Date('2026-11-07T18:30:00Z'))).toBe('ended');
  });
  it('renderThemeOf falls back', () => {
    expect(renderThemeOf(undefined, undefined)).toEqual({ preset: 'everyday', config: EVERYDAY.config });
    const base = row({ id: 9, preset: 'everyday', status: 'base', config: { ...EVERYDAY.config, sign: 'Base sign' } });
    expect(renderThemeOf(undefined, base)).toEqual({ preset: 'everyday', config: base.config });
    expect(renderThemeOf(r, base)).toEqual({ preset: 'diwali', config: r.config });
  });
});

describe('catalogue and presets', () => {
  it('has the 36 stickers with sane boxes', () => {
    expect(Object.keys(STICKERS)).toHaveLength(36);
    for (const [id, s] of Object.entries(STICKERS) as [string, { set: string; box: { w: number; h: number } }][]) {
      expect(isStickerId(id)).toBe(true);
      expect(isPresetKey(s.set)).toBe(true);
      expect(s.box.w).toBeGreaterThan(0);
      expect(s.box.h).toBeGreaterThan(0);
    }
    expect(isStickerId('nope')).toBe(false);
  });
  for (const [key, p] of Object.entries(PRESETS) as [string, Preset][]) {
    it(`preset ${key} is sane`, () => {
      expect(isPresetKey(key)).toBe(true);
      const c: ThemeConfig = p.config;
      for (const pl of c.stickers) expect(isStickerId(pl.id)).toBe(true);
      expect(c.banner.length).toBeLessThanOrEqual(LIMITS.banner);
      expect(c.sign.length).toBeLessThanOrEqual(LIMITS.sign);
      expect(c.chalkLabel.length).toBeLessThanOrEqual(LIMITS.chalkLabel);
      expect(c.chalkTitle.length).toBeLessThanOrEqual(LIMITS.chalkTitle);
      expect(c.chalkSub.length).toBeLessThanOrEqual(LIMITS.chalkSub);
      expect(passesContrast(p.primary)).toBe(true);
      expect(p.brand['--green']).toBe(p.primary);
      if (p.sample) expect(istToDate(p.sample.endsAt).getTime()).toBeGreaterThan(istToDate(p.sample.startsAt).getTime());
      for (const v of [...Object.values(p.brand), ...Object.values(p.stall)]) expect(isHex(v)).toBe(true);
    });
  }
  it('everyday matches today', () => {
    expect(EVERYDAY).toBe(PRESETS.everyday);
    expect(EVERYDAY.primary).toBe('#405746');
    expect(EVERYDAY.config.banner).toBe('Handmade, direct from the maker');
    expect(EVERYDAY.config.stickers).toEqual([]);
  });
});

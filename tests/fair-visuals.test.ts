import { describe, it, expect, vi } from 'vitest';
import { LOOKS } from '@/lib/fair-characters';
import { LOOK_IDS } from '@/lib/fair-constants';
import { avatarSvg, makerAvatar, visitorAvatar } from '@/components/fair/avatar';
import { artDataUri, artInner, artSvg } from '@/components/fair/art';
import { CRAFT_BOX, CRAFT_LABEL, CRAFT_SECONDS, drawCraft } from '@/components/fair/crafts';
import { isWearable, wearFor } from '@/components/fair/wear';
import { SAMPLE_MAKERS } from '@/lib/fair-sample';
import type { ArtKind, CraftKind } from '@/lib/fair-types';

const KINDS: CraftKind[] = ['crochet', 'pottery', 'resin', 'jewellery', 'print', 'wood', 'christmas', 'handmade'];
const ARTS: ArtKind[] = ['frock', 'lily', 'rose', 'tulip', 'drop', 'chandbali', 'bands', 'pot', 'bowls', 'coaster', 'tray', 'stole', 'saree', 'suit', 'woodtoy', 'woodbox', 'tree', 'ornament', 'stocking', 'box'];

describe('avatars', () => {
  it('draws a portrait for each of the ten looks', () => {
    const faces = new Set(LOOK_IDS.map(id => visitorAvatar(LOOKS[id])));
    expect(faces.size).toBe(10);
    for (const f of faces) { expect(f.startsWith('<svg')).toBe(true); expect(f.endsWith('</svg>')).toBe(true); }
  });
  it('shows a turban, a cap, a beard and a bindi where the look has them', () => {
    expect(visitorAvatar(LOOKS.m1)).toContain('<ellipse'); // pagdi
    expect(visitorAvatar(LOOKS.m3)).toContain('rgba(0,0,0,.28)'); // cap brim
    expect(visitorAvatar(LOOKS.m2)).toContain('M21 36q15 24 30 0'); // beard
    expect(visitorAvatar(LOOKS.f1)).toContain('#b3262e'); // bindi
    expect(visitorAvatar(LOOKS.m5)).not.toContain('M21 36q15 24 30 0');
  });
  it('never lets anything but a colour into the picture', () => {
    const svg = avatarSvg({ top: '"><script>alert(1)</script>', acc: 'red;x', skin: 'url(x)', hair: '#fff', headwear: { kind: 'cap', color: '"/><b>' } });
    expect(svg).not.toContain('<script'); expect(svg).not.toContain('<b>'); expect(svg).not.toContain('url(x)');
    expect(artSvg('lily', '"><script>')).not.toContain('<script');
  });
  it('draws makers from the design tokens', () => { expect(makerAvatar(SAMPLE_MAKERS[0].look)).toContain('var(--'); });
});

describe('product art', () => {
  it('has artwork for every kind, as inline SVG and as an image the canvas can draw', () => {
    for (const k of ARTS) { expect(artInner(k, '#b3262e').length, k).toBeGreaterThan(20); expect(artSvg(k)).toContain('viewBox="0 0 48 48"'); expect(artDataUri(k)).toMatch(/^data:image\/svg\+xml/); }
  });
});

describe('wearing things at the mirror', () => {
  it('earrings, sarees, suits and dupattas can be tried on; the rest cannot', () => {
    const item = (art: ArtKind, color?: string) => ({ key: 'k', name: 'n', pricePaise: 1, art, color });
    expect(wearFor(item('drop', '#4fb6b8'))).toEqual({ kind: 'ear', art: 'drop', color: '#4fb6b8' });
    expect(wearFor(item('chandbali'))).toMatchObject({ kind: 'ear', art: 'chandbali' });
    expect(wearFor(item('saree', '#b3262e'))).toEqual({ kind: 'outfit', top: '#b3262e', acc: '#d9a441' });
    expect(wearFor(item('suit', '#35506f'))).toMatchObject({ kind: 'outfit', top: '#35506f' });
    expect(wearFor(item('stole', '#e58aa6'))).toEqual({ kind: 'outfit', acc: '#e58aa6' });
    for (const a of ['tree', 'pot', 'coaster', 'frock'] as ArtKind[]) expect(isWearable(item(a))).toBe(false);
    expect(wearFor(null)).toBeNull();
  });
  it('the sample mirror stall sells something to wear', () => { expect(SAMPLE_MAKERS.find(m => m.mirror)!.items.every(isWearable)).toBe(true); });
});

describe('watching a seller work', () => {
  const ctx = () => {
    const calls: string[] = [];
    const target: Record<string, unknown> = { canvas: {}, calls };
    const proxy: CanvasRenderingContext2D = new Proxy(target, {
      get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => { calls.push(k); return k === 'measureText' ? { width: 10 } : undefined; }),
      set: (t, k: string, v) => { t[k] = v; return true; },
    }) as unknown as CanvasRenderingContext2D;
    return { proxy, calls };
  };
  const colors = { ink: '#252a24', muted: '#77796f', paper: '#f8f4ee', cream: '#eee5d8', white: '#fffdf9', line: '#e5ddd1', green: '#405746', greenInk: '#fff', orange: '#c66b43', sage: '#a8b39a', indigo: '#35506f', mustard: '#d9a441', wood: '#b98458', woodD: '#8a5f3c', terraD: '#9e4e2a', chalk: '#fbf7ef', board: '#2b3a31', ground: '#d8c6a8', skin: '#c98b62', skin2: '#8e5b3c', hair: '#2a211c' };
  it('has a label for every craft and takes ten seconds', () => {
    for (const k of KINDS) expect(CRAFT_LABEL[k], k).toBeTruthy();
    expect(CRAFT_SECONDS).toBe(10); expect(CRAFT_BOX.w).toBeGreaterThan(200);
  });
  it('draws every craft at every stage without failing, and the seller\'s hands are in it', () => {
    for (const k of KINDS) for (const p of [0, .2, .5, .8, .95, 1]) {
      const { proxy, calls } = ctx();
      expect(() => drawCraft(proxy, k, p, 1.3, colors, false, { skin: '#8e5b3c', sleeve: '#c66b43', bangle: '#d9a441' }), `${k} at ${p}`).not.toThrow();
      expect(calls.filter(c => c === 'roundRect').length, `${k} hands`).toBeGreaterThan(2);
    }
  });
  it('uses the seller\'s own skin, sleeve and bangle colours', () => {
    const fills: string[] = [];
    const { proxy } = ctx(); Object.defineProperty(proxy as object, 'fillStyle', { set: (v: string) => { fills.push(String(v)); }, get: () => '' });
    drawCraft(proxy, 'crochet', .5, 0, colors, true, { skin: '#112233', sleeve: '#445566', bangle: '#778899' });
    expect(fills).toEqual(expect.arrayContaining(['#112233', '#445566']));
  });
  it('holds still for people who prefer reduced motion', () => {
    const run = (t: number) => { const { proxy, calls } = ctx(); drawCraft(proxy, 'pottery', .5, t, colors, true); return calls.join(); };
    expect(run(0)).toBe(run(7.3));
    void vi;
  });
});

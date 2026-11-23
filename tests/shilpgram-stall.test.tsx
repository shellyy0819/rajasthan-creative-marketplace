import fs from 'node:fs';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
import { HeroStall } from '@/components/HeroStall';
import { ShilpgramStall } from '@/components/ShilpgramStall';
import { PRESETS, artOf, EVERYDAY } from '@/lib/themes/presets';
import { renderThemeOf } from '@/lib/themes/resolve';

const css = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
const shil = renderToStaticMarkup(<HeroStall art="shilpgram" />);

describe('the Shilpgram stall is a look that is switched on and off like any theme', () => {
  it('only the Shilpgram preset asks for it; everything else, including the everyday stall, draws the picture that was always there', () => {
    expect(artOf('shilpgram')).toBe('shilpgram');
    for (const k of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) if (k !== 'shilpgram') expect(artOf(k), k).toBeUndefined();
    expect(PRESETS.shilpgram.label).toBe('Shilpgram Utsav');
  });
  it('with no live Shilpgram theme (not scheduled, a draft, ended, or none at all) the home page falls back to the everyday stall', () => {
    expect(artOf(renderThemeOf(undefined, undefined).preset)).toBeUndefined();
    expect(renderThemeOf(undefined, undefined).config).toEqual(EVERYDAY.config);
    const everyday = renderToStaticMarkup(<HeroStall />);
    expect(everyday).not.toContain('hero-stall-shilpgram');
    expect(everyday).toContain('Craftofy · Handmade'); // the plain stall's own signboard
    expect(everyday).not.toContain('class="st-crowd"'); // the walking stops with the Shilpgram look...
    expect(everyday).toContain('class="st-bob b1"'); // ...and the standing shoppers are back
  });
  it('is drawn when its theme is live: the village stall instead of the market stall, with the crowd still in front', () => {
    expect(shil).toContain('hero-stall-shilpgram');
    expect(shil).toContain('class="st-crowd"');
    expect(shil).not.toContain('st-blk'); // not the everyday stall's block-print counter
    expect(shil).toContain('A little more handmade goes a long way.');
  });
  it('the home page and the theme editor pass the look on (source contract)', () => {
    expect(fs.readFileSync('src/app/page.tsx', 'utf8')).toContain('art={artOf(theme.preset)}');
    expect(fs.readFileSync('src/components/ThemeEditor.tsx', 'utf8')).toContain('art={artOf(preset)}');
  });
  it('is on the same canvas as the everyday stall (600 x 720) and keeps the people where the crowd expects them', () => {
    expect(shil).toContain('viewBox="0 0 600 720"');
    expect(shil).toContain('translate(212 478)'); // the woman maker, at the left maker's place
    expect(shil).toContain('M392 478V420'); // the man maker, at the right maker's place
    expect(shil.indexOf('class="st-crowd"')).toBeGreaterThan(shil.lastIndexOf('<rect x="84" y="470"')); // the crowd is drawn after the counter
    expect(shil.indexOf('class="st-crowd"')).toBeGreaterThan(shil.indexOf('Craftofy at Shilpgram'.slice(0, 4)) - 1);
  });
});

describe('what it shows', () => {
  it('has a saree on the woman (pallu over the shoulder and her head), a turban and moustache on the man, and two eyes each', () => {
    const woman = shil.slice(shil.indexOf('translate(212 478)'), shil.indexOf('M392 478V420'));
    expect(woman).toContain('M188 404L202 394L240 446'); // the pallu across the chest
    expect(woman).toContain('M194 380Q190 342 212 340'); // the same cloth over her head
    expect(woman.match(/<ellipse/g)).toHaveLength(2); // two eyes
    const man = shil.slice(shil.indexOf('M392 478V420'), shil.indexOf('<rect x="84" y="470"'));
    expect(man.match(/<ellipse/g)).toHaveLength(2);
    expect(man).toContain('M409 379q9-7 18 0'); // moustache
    expect(man).toContain('M402 366Q400 340'); // pagri
  });
  it('has the village: thatched roof, mud walls with mirror work, hills, kathputli puppets, clay pots, marigold garland', () => {
    for (const part of ['st-f-thatch"', 'st-f-mud"', 'sg-mir', 'st-f-hill"', 'st-f-hill2"', 'sg-gar', 'M265 424L276 392', 'M254 470C246 470']) expect(shil, part).toContain(part);
  });
  it('shows the theme\'s own wording on the signboard and on the easel board, and the board is a link when it has somewhere to go', () => {
    const html = renderToStaticMarkup(<ShilpgramStall sign="Shilpgram Utsav" chalkLabel="Utsav" chalkTitle="Meet the maker" chalkSub="Udaipur" chalkHref="/shop" />);
    expect(html).toContain('Shilpgram Utsav');
    expect(html).toContain('class="st-board-link"');
    expect(html).toContain('href="/shop"');
    const open = (h: string) => h.match(/<svg[^>]*>/)![0];
    expect(open(html)).not.toContain('aria-hidden'); // a link stays reachable for screen readers
    expect(renderToStaticMarkup(<ShilpgramStall chalkLabel="" chalkTitle="" chalkSub="" />)).not.toContain('st-board-link');
    expect(open(renderToStaticMarkup(<ShilpgramStall />))).toContain('aria-hidden="true"');
  });
  it('is drawn only with stall colour classes (no hex values, no scripts) and has no duplicate ids', () => {
    const picture = shil.slice(0, shil.indexOf('A little more handmade')); // the sticker layer after it carries its own fixed festive colours
    expect(picture).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(picture).not.toMatch(/<script|onClick|\sstyle="/);
    const ids = [...shil.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('its colours follow light and dark', () => {
  const tokens = ['--stall-sun', '--stall-hill', '--stall-hill-2', '--stall-mud', '--stall-mud-l', '--stall-thatch', '--stall-thatch-d', '--stall-leaf'];
  it('every new token is defined for light, for the dark system preference and for the dark switch', () => {
    for (const t of tokens) expect([...css.matchAll(new RegExp(`${t}: #[0-9a-f]{6}`, 'gi'))].length, t).toBe(3);
  });
  it('every colour class the picture uses exists in the stylesheet', () => {
    const used = new Set([...shil.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)).filter(c => /^st-[fst]-/.test(c)));
    for (const c of used) expect(css, c).toMatch(new RegExp(`\\.${c} \\{`));
  });
});

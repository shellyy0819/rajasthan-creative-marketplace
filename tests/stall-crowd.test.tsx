import fs from 'node:fs';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StallCrowd } from '@/components/StallCrowd';
import { HeroStall } from '@/components/HeroStall';

const css = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
const crowd = renderToStaticMarkup(<StallCrowd />);

describe('the people at the home stall', () => {
  it('are in the stall picture itself, so they are in the first HTML', () => {
    expect(renderToStaticMarkup(<HeroStall />)).toContain('class="st-crowd"');
  });
  it('are two purchases and nine people strolling across the section (two of them stop for selfies), drawn with the stall colour classes and no hex values', () => {
    expect(crowd.match(/class="st-deal"/g)).toHaveLength(2);
    expect(crowd.match(/class="st-pass (r|l)"/g)).toHaveLength(7);
    expect(crowd.match(/class="st-pass sf"/g)).toHaveLength(2);
    expect(crowd).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(crowd).not.toMatch(/<script|onClick|style="[^"]*(fill|stroke)/);
  });
  it('have loops of different lengths that start at different points, so the scene never repeats in step', () => {
    const times = [...crowd.matchAll(/--T:(\d+)s;--D:(-\d+)s/g)].map(m => `${m[1]}/${m[2]}`);
    expect(times).toHaveLength(11);
    expect(new Set(times).size).toBe(11);
    expect(new Set(times.map(t => t.split('/')[0])).size).toBe(11); // and no two loops are the same length
  });
  it('each purchase has a buyer who walks in and stops, a parcel, money for the maker on the right and a wrapping hand for the maker on the left', () => {
    for (const part of ['st-cy buyer', 'st-cy show-walk', 'st-cy show-stand', 'st-cy parcel', 'st-cy note', 'st-cy show-wrap', 'st-cy show-take', 'st-cy coin']) expect(crowd.split(`class="${part}"`).length - 1, part).toBe(2);
  });
});

describe('nobody stands still', () => {
  const seconds = (t: string) => +t.replace('s', '');
  it('the four shoppers who used to stand by the stall are only drawn for reduced motion; everyone else sees them walk', () => {
    const stall = renderToStaticMarkup(<HeroStall />);
    expect(stall).toContain('class="st-still"');
    expect(stall.slice(stall.indexOf('class="st-still"'), stall.indexOf('class="st-crowd"'))).toContain('st-bob b1');
    expect(css).toMatch(/\.st-still \{ display: none; \}/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^@]*\.st-still \{ display: inline; \}/);
    // the walkers that replace them: a plait, a pot being looked at, a parcel, a second selfie taker
    expect(crowd).toContain('M-1 563Q-6 588 0 608');
    expect(crowd).toContain('M23 556Q21 546 25 542H31Q35 546 33 556Z');
    expect(crowd).toContain('M13 603H29');
  });
  it('the longest anyone stops is under 20 seconds: a buyer at the counter (16% to 62% of the loop) or a selfie taker (36% to 58%)', () => {
    const buyers = [...crowd.matchAll(/class="st-deal" style="--sx:\d+;--T:(\d+s)/g)].map(m => seconds(m[1]));
    const selfies = [...crowd.matchAll(/class="st-pass sf" style="--T:(\d+s)/g)].map(m => seconds(m[1]));
    expect(buyers).toHaveLength(2); expect(selfies).toHaveLength(2);
    const buyerStop = css.match(/@keyframes st-show-stand \{ 0%, (\d+)% \{ opacity: 0; \} [\d.]+%, (\d+)% \{ opacity: 1; \}/)!;
    const selfieStop = css.match(/@keyframes st-sf-stand \{ 0%, (\d+)% \{ opacity: 0; \} [\d.]+%, (\d+)% \{ opacity: 1; \}/)!;
    for (const t of buyers) expect(t * (+buyerStop[2] - +buyerStop[1]) / 100).toBeLessThan(20);
    for (const t of selfies) expect(t * (+selfieStop[2] - +selfieStop[1]) / 100).toBeLessThan(20);
  });
});

describe('who is walking by', () => {
  it('has a selfie taker with a phone and a flash, a shopper with four bags, a tourist with hat, sunglasses, camera and bags, a woman in a saree and a man in a kurta and turban', () => {
    expect(crowd).toContain('st-cy sf-flash');
    expect(crowd.match(/class="st-bags"/g)!.length).toBeGreaterThanOrEqual(2); // the shopper and the tourist, each walking figure once
    const shopper = crowd.slice(crowd.indexOf('class="st-bags"'));
    expect(shopper.slice(0, shopper.indexOf('</g></g>')).match(/<rect /g)!.length).toBe(4); // four bags in one hand
    expect(crowd).toContain('rx="1.8" class="st-f-board"'); // sunglasses
    expect(crowd).toMatch(/M-3 589|<rect x="-3" y="589"/); // camera
    expect(crowd).toContain('M-10 622L-15 655'); // saree skirt
    expect(crowd).toContain('M-10 652L-8 572'); // kurta
    expect(crowd).toContain('st-s-mustard'); // turban band
  });
  it('they come from both sides, and walk across the whole section: the range is measured per screen and has a default', () => {
    expect(crowd).toContain('class="st-pass r"');
    expect(crowd).toContain('class="st-pass l"');
    expect(css).toMatch(/\.st-crowd \{ --L: \d+; --R: \d+; pointer-events: none; \}/);
    expect(css).toMatch(/@keyframes st-pass-r \{ from \{ transform: translateX\(calc\(var\(--L\) \* -1px - 60px\)\); \} to \{ transform: translateX\(calc\(660px \+ var\(--R\) \* 1px\)\)/);
    expect(fs.readFileSync('src/components/StallRange.tsx', 'utf8')).toContain("setProperty('--L'");
  });
  it('the hero lets them walk across all of it (cut off at its edges), in front of the words and buttons', () => {
    expect(css).toMatch(/\.hero \{ position: relative; overflow-x: clip;/);
    expect(css).toMatch(/\.hero-copy \{ position: relative; z-index: 1; \}/);
    expect(css).toMatch(/\.hero-art \{ position: relative; z-index: 2; \}/);
  });
  it('the crowd is the last thing drawn in the stall, so no sign, board or sticker covers it', () => {
    const src = fs.readFileSync('src/components/HeroStall.tsx', 'utf8');
    expect(src.indexOf('<StallCrowd />')).toBeGreaterThan(src.indexOf('<StickerLayer'));
    expect(src.match(/<StallCrowd \/>/g)).toHaveLength(1);
  });
});

describe('the crowd animation (source contract)', () => {
  it('every named animation exists', () => {
    const used = new Set([...css.matchAll(/animation-name: ([\w-]+);/g)].map(m => m[1]));
    for (const name of used) expect(css, name).toMatch(new RegExp(`@keyframes ${name} \\{`));
    expect(used.size).toBeGreaterThanOrEqual(9);
  });
  it('a buyer stops at the counter (same position held between 16% and 62%) and the parcel ends in their hand', () => {
    expect(css).toMatch(/@keyframes st-buyer-x \{[^@]*16%, 62% \{ transform: translateX\(0\); \}/);
    expect(css).toMatch(/@keyframes st-parcel \{[^@]*60%, 100% \{ opacity: 1; transform: translate\(14px, 598px\)/);
  });
  it('the money ends at the right-hand maker and the wrapping starts before the parcel moves', () => {
    expect(css).toMatch(/@keyframes st-note \{[^@]*46% \{[^}]*translate\(calc\(\(412 - var\(--sx\)\) \* 1px\), 460px\)/);
    expect(css).toMatch(/@keyframes st-show-wrap \{ 0%, 27% \{ opacity: 0; \} 27\.1%, 47% \{ opacity: 1; \}/);
  });
  it('with reduced motion the whole layer is hidden, so nothing is left frozen mid-walk', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^@]*\.st-crowd \{ display: none; \}/);
  });
});

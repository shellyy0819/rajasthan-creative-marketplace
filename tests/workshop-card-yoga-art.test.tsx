import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/ReserveButton', () => ({ ReserveButton: () => <button>Reserve</button> }));
vi.mock('@/components/WorkshopContact', () => ({ WorkshopContact: () => <span data-contact /> }));

import { WorkshopCard } from '@/components/WorkshopCard';
import { ClassIllustration } from '@/components/class/ClassIllustration';
import { isYogaListing } from '@/lib/class-page';
import type { Workshop } from '@/lib/types';

/** A listing with the fields a card reads; invented data. */
const base = {
  id: 'w1', title: 'Morning flow', kind: 'class', mode: 'online', platform: 'Zoom', host: 'Sample Host', city: null,
  date: '2026-12-01', time: '06:30', venue: '', seats: null, booked: 0, type: 'FREE', pricePaise: 0, prices: [],
  images: [], level: null, languages: [], freeTrial: false, freeTrialDays: null, schedule: null, topicId: 1,
  topic: { id: 1, name: 'Yoga', slug: 'yoga' },
} as unknown as Workshop;

describe('yoga listing without a photo', () => {
  it('the card shows the yoga illustration, with the same chip a photo card has', () => {
    const h = renderToStaticMarkup(<WorkshopCard w={base} />);
    expect(h).toContain('date-tile has-photo has-art');
    expect(h).toContain('six people practising yoga');
    expect(h).toContain('class="tile-chip">Online · Zoom<');
    expect(h).toContain('workshop-card with-photo');
    expect(h).not.toContain('<b>Online</b>');
  });
  it('a listing with a photo keeps its photo, not the illustration', () => {
    const h = renderToStaticMarkup(<WorkshopCard w={{ ...base, images: ['https://example.com/a.jpg'] }} />);
    expect(h).toContain('src="https://example.com/a.jpg"');
    expect(h).not.toContain('has-art');
  });
  it('another category gets its own illustration, and a category with none of its own gets the generic one', () => {
    const cases: [string, string, string][] = [['crochet', 'Crochet', 'crocheting together'], ['painting', 'Painting', 'at their own easels'], ['food', 'Food', 'chef hats'], ['resin-jesmonite', 'Resin & Jesmonite', 'pouring blue resin'], ['pottery', 'Pottery', 'craft studio']];
    for (const [slug, name, alt] of cases) {
      const h = renderToStaticMarkup(<WorkshopCard w={{ ...base, topic: { id: 2, name, slug } }} />);
      expect(h, name).toContain('date-tile has-photo has-art');
      expect(h, name).toContain(alt);
      expect(h, name).not.toContain('six people');
    }
  });
  it('a listing with no category gets the picture its title says, else the generic one', () => {
    const t = (title: string) => renderToStaticMarkup(<WorkshopCard w={{ ...base, title, topic: undefined, topicId: null }} />);
    expect(t('Crochet a bag')).toContain('crocheting together');
    expect(t('Watercolour painting')).toContain('at their own easels');
    expect(t('Rajasthani cooking class')).toContain('chef hats');
    expect(t('Resin coasters')).toContain('pouring blue resin');
    expect(t('Morning flow')).toContain('craft studio');
  });
  it('an in-person yoga listing shows the date in the chip', () => {
    const h = renderToStaticMarkup(<WorkshopCard w={{ ...base, kind: 'workshop', mode: 'in_person', platform: null, city: 'Jaipur', venue: 'Studio', seats: 10 } as unknown as Workshop} />);
    expect(h).toContain('has-art');
    expect(h).toContain('class="tile-chip">1 Dec<');
  });
});

describe('what counts as a yoga listing', () => {
  it('the category decides when there is one', () => {
    expect(isYogaListing({ title: 'Morning flow', topic: { id: 1, name: 'Yoga', slug: 'yoga' } })).toBe(true);
    expect(isYogaListing({ title: 'Morning flow', topic: { id: 1, name: 'Yoga & Wellness', slug: 'yoga-and-wellness' } })).toBe(true);
    expect(isYogaListing({ title: 'Yoga on clay', topic: { id: 2, name: 'Pottery', slug: 'pottery' } })).toBe(false);
  });
  it('with no category the title decides, as a whole word', () => {
    expect(isYogaListing({ title: 'Yoga', topic: undefined })).toBe(true);
    expect(isYogaListing({ title: 'Sunrise yoga flow', topic: undefined })).toBe(true);
    expect(isYogaListing({ title: 'Pottery basics', topic: undefined })).toBe(false);
    expect(isYogaListing({ title: 'Yogaville tour', topic: undefined })).toBe(false);
  });
  it('a card with no category but a yoga title shows the illustration', () => {
    const h = renderToStaticMarkup(<WorkshopCard w={{ ...base, title: 'Yoga', topic: undefined, topicId: null }} />);
    expect(h).toContain('has-art');
  });
});

describe('the class page picture', () => {
  it('draws the yoga scene for yoga, the craft scene for crochet, painting, food and resin, and the sun and arch with flowers otherwise', () => {
    expect(renderToStaticMarkup(<ClassIllustration title="T" kind="yoga" />)).toContain('six people practising yoga');
    for (const [kind, alt] of [['crochet', 'crocheting together'], ['painting', 'at their own easels'], ['food', 'chef hats'], ['resin', 'pouring blue resin']] as const) expect(renderToStaticMarkup(<ClassIllustration title="T" kind={kind} />), kind).toContain(alt);
    const plain = renderToStaticMarkup(<ClassIllustration title="T" kind="generic" />);
    expect(plain).toContain('craft studio');
    expect(plain).not.toContain('yoga');
  });
  it('the in-person page (CraftDetail) passes the category too (source contract)', () => {
    const src = fs.readFileSync('src/components/class/CraftDetail.tsx', 'utf8');
    expect(src).toContain('<ClassIllustration title={w.title} kind={artKind(w)} />');
  });
  it('the card tile stretches the art over the whole tile (source contract)', () => {
    const css = fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ');
    expect(css).toMatch(/\.date-tile\.has-art svg \{[^}]*position: absolute; inset: 0;[^}]*width: 100%; height: 100%/);
  });
});

describe('the group pictures', () => {
  const kinds = ['crochet', 'painting', 'food', 'resin', 'generic'] as const;
  it('show four people each, drawn once and reused', () => {
    for (const kind of kinds) {
      const h = renderToStaticMarkup(<ClassIllustration title="T" kind={kind} />);
      const uses = h.match(/<use /g) ?? [];
      expect(uses.length, kind).toBeGreaterThanOrEqual(4);
      expect(h, kind).toContain('<defs>');
    }
  });
  it('give each picture ids of its own, so two on one page never share a person', () => {
    const h = renderToStaticMarkup(<><ClassIllustration title="A" kind="food" /><ClassIllustration title="B" kind="food" /></>);
    const ids = [...h.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const ref of h.matchAll(/href="#([^"]+)"/g)) expect(ids, ref[1]).toContain(ref[1]);
  });
  it('move gently, and stand still for people who ask for less motion (source contract)', () => {
    const css = fs.readFileSync('src/components/class/ClassArt.css', 'utf8').replace(/\s+/g, ' ');
    for (const k of ['rr-bob', 'rr-steam', 'rr-glow', 'rr-flow', 'rr-stir', 'rr-spark', 'rr-stamp', 'rr-sway']) expect(css, k).toContain(`@keyframes ${k}`);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^@]*animation: none;/);
    expect(fs.readFileSync('src/components/class/ClassIllustration.tsx', 'utf8')).toContain("import './ClassArt.css'");
  });
  it('use only the site colours (no hex values in the scenes)', () => {
    expect(fs.readFileSync('src/components/class/MakerScenes.tsx', 'utf8')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('the yoga illustration colours (source contract)', () => {
  const css = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\s+/g, ' ');
  it('the warrior and arms-up figures use deep tones on light and bright mustard and orange on dark, in both dark blocks', () => {
    expect(css).toMatch(/--art-warrior: var\(--stall-terra-d\);/);
    expect(css).toMatch(/--art-arms: var\(--stall-wood-d\);/);
    expect((css.match(/--art-warrior: var\(--stall-mustard\);/g) ?? []).length).toBe(2);
    expect((css.match(/--art-arms: var\(--orange\);/g) ?? []).length).toBe(2);
  });
  it('the illustration reads those tokens', () => {
    const src = fs.readFileSync('src/components/class/ClassIllustration.tsx', 'utf8');
    expect(src).toContain("fig('--art-warrior')");
    expect(src).toContain("fig('--art-arms')");
  });
});

describe('the date or Online chip on a card with a picture', () => {
  it('sits beside the picture on laptops and as a label above the title on phones, on every card', () => {
    const photo = renderToStaticMarkup(<WorkshopCard w={{ ...base, images: ['https://example.com/a.jpg'] }} />);
    expect(photo).toMatch(/<div class="tile-col"><div class="date-tile has-photo">.*<\/div><span class="tile-chip">/);
    expect(photo).toContain('<span class="ws-eyebrow">Online · Zoom</span>');
    const other = renderToStaticMarkup(<WorkshopCard w={{ ...base, title: 'Morning flow', topic: undefined, topicId: null }} />);
    expect(other).toContain('<span class="ws-eyebrow">Online · Zoom</span>'); // every card has a picture, so every card has the label
  });
});

describe('the level and language tags on phones', () => {
  it('use the small bold type and corner of the free trial tag, and keep their own outline and colours (source contract)', () => {
    const css = fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ');
    const tag = css.match(/\.ws-badges span \{ padding: 2px 8px;([^}]*)\}/)?.[1] ?? '';
    const trial = css.match(/article\.workshop-card \.ws-price-trial \{([^}]*)\}/)?.[1] ?? '';
    for (const part of ['font: 700 9px/1.25', 'border-radius: 12px;', 'background: var(--orange);']) expect(trial).toContain(part);
    for (const part of ['font-size: 9px;', 'font-weight: 700;', 'border-radius: 12px;']) expect(tag).toContain(part);
    for (const part of ['background', 'color:', 'border:']) expect(tag).not.toContain(part);
  });
});

describe('who runs it, the free trial tag and the seats by the price on phones', () => {
  it('names the role: Instructor for an online class, Host for an in-person workshop', () => {
    expect(renderToStaticMarkup(<WorkshopCard w={base} />)).toContain('Instructor: ');
    const inPerson = renderToStaticMarkup(<WorkshopCard w={{ ...base, kind: 'workshop', mode: 'in_person', type: 'FREE', seats: 12, booked: 4, venue: 'Studio 9', time: '16:30', date: '2099-12-01', topic: undefined, topicId: null } as never} />);
    expect(inPerson).toContain('Host: ');
    expect(inPerson).toContain('8 seats left');
  });
  it('the free trial tag by the price repeats the one on the photo, for phones only', () => {
    const h = renderToStaticMarkup(<WorkshopCard w={{ ...base, images: ['https://example.com/a.jpg'], freeTrial: true, freeTrialDays: 2 }} />);
    expect(h).toContain('<span class="ws-price-trial">2-day free trial</span>');
    expect(renderToStaticMarkup(<WorkshopCard w={{ ...base, title: 'Morning flow', topic: undefined, topicId: null, freeTrial: true, freeTrialDays: 2 }} />)).toContain('ws-price-trial'); // a card with the generic picture too
    expect(renderToStaticMarkup(<WorkshopCard w={base} />)).not.toContain('ws-price-trial');
  });
});

describe('the free trial on a card with a picture', () => {
  it('is a chip on the photo (like "Only 1 left" on a product card) and not repeated as a badge', () => {
    const h = renderToStaticMarkup(<WorkshopCard w={{ ...base, images: ['https://example.com/a.jpg'], freeTrial: true, freeTrialDays: 2 }} />);
    expect(h).toContain('<span class="tile-trial">2-day free trial</span>');
    expect(h).not.toContain('Free trial ·');
    expect(h).not.toContain('ws-badges');
  });
  it('is a chip on the yoga illustration too, and says "Free trial" when no length is given', () => {
    const h = renderToStaticMarkup(<WorkshopCard w={{ ...base, freeTrial: true, freeTrialDays: null }} />);
    expect(h).toContain('has-art');
    expect(h).toContain('<span class="tile-trial">Free trial</span>');
  });
  it('a card without a trial has neither tag', () => {
    expect(renderToStaticMarkup(<WorkshopCard w={{ ...base, images: ['https://example.com/a.jpg'] }} />)).not.toContain('tile-trial');
    expect(renderToStaticMarkup(<WorkshopCard w={base} />)).not.toContain('tile-trial');
  });
  it('the chip is the site\'s orange chip with white text, at the top left of the tile (source contract)', () => {
    const css = fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ');
    expect(css).toMatch(/\.tile-col \.tile-trial \{ position: absolute; left: 8px; top: 8px;[^}]*background: var\(--orange\); color: #fffdf9;/);
  });
});

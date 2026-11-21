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
  it('another category without a photo keeps the plain tile', () => {
    const h = renderToStaticMarkup(<WorkshopCard w={{ ...base, topic: { id: 2, name: 'Pottery', slug: 'pottery' } }} />);
    expect(h).toContain('<b>Online</b>');
    expect(h).not.toContain('has-art');
    expect(h).not.toContain('workshop-card with-photo');
  });
  it('a listing with no category and no yoga in its title keeps the plain tile', () => {
    const h = renderToStaticMarkup(<WorkshopCard w={{ ...base, title: 'Morning flow', topic: undefined, topicId: null }} />);
    expect(h).toContain('<b>Online</b>');
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
  it('draws the yoga scene for yoga and the plain sun and arch otherwise', () => {
    expect(renderToStaticMarkup(<ClassIllustration title="T" yoga />)).toContain('six people practising yoga');
    const plain = renderToStaticMarkup(<ClassIllustration title="T" yoga={false} />);
    expect(plain).toContain('rising sun behind a Rajasthani arch');
    expect(plain).not.toContain('yoga');
  });
  it('the in-person page (CraftDetail) passes the category too (source contract)', () => {
    const src = fs.readFileSync('src/components/class/CraftDetail.tsx', 'utf8');
    expect(src).toContain('<ClassIllustration title={w.title} yoga={isYogaListing(w)} />');
  });
  it('the card tile stretches the art over the whole tile (source contract)', () => {
    const css = fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ');
    expect(css).toMatch(/\.date-tile\.has-art svg \{[^}]*position: absolute; inset: 0;[^}]*width: 100%; height: 100%/);
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
  it('stays a badge under the title on the plain date tile, and a card without a trial has neither', () => {
    const plain = renderToStaticMarkup(<WorkshopCard w={{ ...base, title: 'Morning flow', topic: undefined, topicId: null, freeTrial: true, freeTrialDays: 2 }} />);
    expect(plain).not.toContain('tile-trial');
    expect(plain).toContain('Free trial · 2 days');
    const none = renderToStaticMarkup(<WorkshopCard w={{ ...base, images: ['https://example.com/a.jpg'] }} />);
    expect(none).not.toContain('tile-trial');
  });
  it('the chip is the site\'s orange chip with white text, at the top left of the tile (source contract)', () => {
    const css = fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ');
    expect(css).toMatch(/\.date-tile\.has-photo \.tile-trial \{ position: absolute; left: 8px; top: 8px;[^}]*background: var\(--orange\); color: #fffdf9;/);
  });
});

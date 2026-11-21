import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/ReserveButton', () => ({ ReserveButton: () => <button>Reserve</button> }));
vi.mock('@/components/WorkshopContact', () => ({ WorkshopContact: () => <span data-contact /> }));

import { WorkshopCard } from '@/components/WorkshopCard';
import { ClassIllustration } from '@/components/class/ClassIllustration';
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
  it('a listing with no category keeps the plain tile', () => {
    const h = renderToStaticMarkup(<WorkshopCard w={{ ...base, topic: undefined, topicId: null }} />);
    expect(h).toContain('<b>Online</b>');
  });
  it('an in-person yoga listing shows the date in the chip', () => {
    const h = renderToStaticMarkup(<WorkshopCard w={{ ...base, kind: 'workshop', mode: 'in_person', platform: null, city: 'Jaipur', venue: 'Studio', seats: 10 } as unknown as Workshop} />);
    expect(h).toContain('has-art');
    expect(h).toContain('class="tile-chip">1 Dec<');
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
    expect(src).toMatch(/<ClassIllustration title=\{w\.title\} yoga=\{w\.topic\?\.slug === 'yoga'\} \/>/);
  });
  it('the card tile stretches the art over the whole tile (source contract)', () => {
    const css = fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ');
    expect(css).toMatch(/\.date-tile\.has-art svg \{[^}]*position: absolute; inset: 0;[^}]*width: 100%; height: 100%/);
  });
});

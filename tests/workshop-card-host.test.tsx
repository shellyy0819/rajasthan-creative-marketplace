import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/StoreProvider', () => ({ useStore: () => ({ openBooking: () => {} }) }));
import { WorkshopCard } from '@/components/WorkshopCard';

const base = { id: 'w1', title: 'Trinket tray painting', host: 'Linking House', venue: 'Santacruz', date: '2026-11-28', time: '15:00', type: 'PAID', pricePaise: 99900, prices: [], images: [], languages: ['Hindi'], level: 'ALL', seats: 12, booked: 2, instagram: null, whatsapp: null, publicPhone: null, website: null, kind: 'workshop', mode: 'in-person' } as const;
const render = (extra: object, over: object = {}) => renderToStaticMarkup(<WorkshopCard w={{ ...base, ...over, ...extra } as never} />);

describe('the host line on a workshop card', () => {
  it('links the host name to their profile and shows their photo', () => {
    const html = render({ hostSlug: 'linking-house-142ada70', hostLogo: 'https://cdn.example.com/logo.jpg' });
    expect(html).toContain('href="/artists/linking-house-142ada70"');
    expect(html).toMatch(/<img class="ws-host-avatar" src="https:\/\/cdn\.example\.com\/logo\.jpg"/);
    expect(html).toContain('Host: ');
  });
  it('shows the placeholder icon when the host has no photo, still linked', () => {
    const html = render({ hostSlug: 'linking-house-142ada70' });
    expect(html).toContain('href="/artists/linking-house-142ada70"');
    expect(html).toMatch(/<svg class="ws-host-avatar"/);
    expect(html).not.toContain('<img class="ws-host-avatar"');
  });
  it('is plain text with the placeholder when the host has no profile page', () => {
    const html = render({});
    expect(html).not.toContain('/artists/');
    expect(html).toMatch(/<svg class="ws-host-avatar"/);
    expect(html).toContain('Linking House');
  });
  it('an online class says Instructor and links the same way', () => {
    const html = render({ hostSlug: 'linking-house-142ada70' }, { kind: 'class', mode: 'online', seats: null, schedule: null });
    expect(html).toContain('Instructor: ');
    expect(html).toContain('href="/artists/linking-house-142ada70"');
  });
});

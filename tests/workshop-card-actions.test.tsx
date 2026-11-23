import fs from 'node:fs';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/StoreProvider', () => ({ useStore: () => ({ openBooking: () => {} }) }));
import { WorkshopCard } from '@/components/WorkshopCard';

const base = { id: 'w1', title: 'Trinket tray painting', host: 'Linking House', venue: 'Santacruz', date: '2026-11-28', time: '15:00', type: 'PAID', pricePaise: 99900, prices: [], images: [], languages: ['Hindi'], level: 'ALL', seats: 12, booked: 2, instagram: 'linkinghouse', whatsapp: null, publicPhone: null, website: null, kind: 'workshop', mode: 'in-person' } as never;

describe('workshop card actions are the same for every kind of listing', () => {
  it('an in-person workshop with seats shows the host\'s Instagram beside Reserve spot', () => {
    const html = renderToStaticMarkup(<WorkshopCard w={base} />);
    expect(html).toContain('ws-icon ws-insta');
    expect(html).toContain('Reserve spot');
    expect(html.indexOf('ws-insta')).toBeLessThan(html.indexOf('Reserve spot'));
  });
  it('an online class shows the same icons and no Reserve button', () => {
    const html = renderToStaticMarkup(<WorkshopCard w={{ ...(base as object), kind: 'class', mode: 'online', seats: null, schedule: null } as never} />);
    expect(html).toContain('ws-icon ws-insta');
    expect(html).not.toContain('Reserve spot');
  });
  it('a workshop with seats and no contact details still shows Reserve spot alone', () => {
    const html = renderToStaticMarkup(<WorkshopCard w={{ ...(base as object), instagram: null } as never} />);
    expect(html).not.toContain('ws-contact');
    expect(html).toContain('Reserve spot');
  });
  it('both sit in one row at the end of the price column (source contract)', () => {
    const css = fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ');
    expect(css).toMatch(/\.workshop-card \.ws-actions \{[^}]*display: flex;[^}]*justify-content: flex-end;/);
    expect(css).toMatch(/\.ws-actions > \.ws-contact:not\(:last-child\) \.ws-icon:last-child \{ margin-right: 0; \}/);
  });
  it('an ended listing stays in the list, marked Ended, with nothing to book or contact', () => {
    const ended = { ...(base as object), date: '2020-01-02' } as never;
    const html = renderToStaticMarkup(<WorkshopCard w={ended} />);
    expect(html).toContain('is-ended');
    expect(html).toContain('Ended · 2 Jan');
    expect(html).not.toContain('Reserve spot');
    expect(html).not.toContain('ws-contact');
    expect(html).toContain('/workshops/'); // its page is still there
    const klass = renderToStaticMarkup(<WorkshopCard w={{ ...(base as object), kind: 'class', mode: 'online', seats: null, schedule: null, endsOn: '2020-01-31', freeTrial: true } as never} />);
    expect(klass).toContain('>Ended<');
    expect(klass).not.toContain('free trial');
    expect(klass).not.toContain('ws-contact');
    expect(renderToStaticMarkup(<WorkshopCard w={{ ...(base as object), date: '2099-01-02' } as never} />)).not.toContain('is-ended');
  });
});

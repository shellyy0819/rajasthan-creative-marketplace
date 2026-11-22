import fs from 'node:fs';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/components/ReserveButton', () => ({ ReserveButton: () => <button data-reserve>Reserve a spot</button> }));
import { CraftDetail } from '@/components/class/CraftDetail';
import type { Workshop } from '@/lib/types';

const base = {
  id: 'w7', title: 'Block printing on cotton', type: 'PAID', pricePaise: 120000, kind: 'workshop', mode: 'in_person', topicId: 1, topic: { id: 1, name: 'Block printing', slug: 'block-printing' },
  city: 'Jaipur', cityId: 1, citySlug: 'jaipur', venue: 'Rang Studio, Bani Park', date: '2026-11-22', time: '16:00', endsOn: null, seats: 12, booked: 4, host: 'Rang Studio',
  description: 'Hands-on printing with wooden blocks.', status: 'APPROVED', platform: null, schedule: null, languages: ['Hindi', 'English'], level: 'beginner', experience: '12 years of block printing', certifications: null,
  freeTrial: false, freeTrialDays: null, whatsapp: '+919989898999', instagram: 'rangstudio', website: 'https://rang.in', images: [], prices: [],
  makes: [{ title: 'A cotton tote bag', text: 'Printed with a border.' }, { title: 'Two swatches', text: '' }], included: ['Blocks and dyes', 'Masala chai'], bring: ['Old clothes'], minAge: 14,
} as unknown as Workshop;
const now = new Date('2026-11-19T06:00:00Z');
const html = (over: Partial<Workshop> = {}, ended = false) => renderToStaticMarkup(<CraftDetail w={{ ...base, ...over } as Workshop} ended={ended} now={now} />);

describe('the picture on laptops (source contract)', () => {
  const css = fs.readFileSync('src/components/class/CraftDetail.css', 'utf8').replace(/\s+/g, ' ');
  it('runs from the top of the eyebrow to the bottom of the Share button: it stretches over row 1 and the payment note sits in row 2 of the text column', () => {
    expect(css).toMatch(/@media \(min-width: 901px\) \{ \.cd-hero\.cr-hero \{[^}]*align-items: stretch;/);
    expect(css).toMatch(/\.cr-hero \.cd-media \{ grid-column: 2; grid-row: 1;/);
    expect(css).toMatch(/\.cr-hero \.cr-note \{ grid-column: 1; grid-row: 2;/);
  });
  it('one, two or three photos fill the box and add nothing to its height, so they never run past the Share button', () => {
    expect(css).toMatch(/\.cr-hero \.cd-media \{[^}]*position: relative;/);
    expect(css).toMatch(/\.cr-hero \.cd-mosaic \{ position: absolute; inset: 0; aspect-ratio: auto; height: auto; \}/);
  });
  it('the payment note is a sibling of the text column, not inside it', () => {
    const h = html();
    const afterText = h.slice(h.indexOf('class="cd-hero-text"'));
    expect(afterText.indexOf('cr-note')).toBeGreaterThan(0);
    // the slice starts inside the text column's opening tag, so by the note its tag has closed: one more </div> than <div>
    const before = afterText.slice(0, afterText.indexOf('cr-note'));
    expect((before.match(/<\/div>/g) ?? []).length).toBe((before.match(/<div/g) ?? []).length + 1);
  });
});

describe('a short page has no empty block under it', () => {
  it('without what-you-make, included or bring-along lists there is no empty body, and the body never keeps the full-screen minimum height (source contract)', () => {
    expect(html({ makes: [], included: [], bring: [] } as never)).not.toContain('cd-body');
    expect(html()).toContain('cd-body');
    expect(fs.readFileSync('src/components/class/ClassDetail.css', 'utf8').replace(/\s+/g, ' ')).toMatch(/\.cd-main \{[^}]*min-height: 0;/);
  });
});

describe('craft and art workshop page', () => {
  it('opens with the date, the venue, the seats, the price and the Reserve button', () => {
    const h = html();
    expect(h).toContain('WORKSHOP · BLOCK PRINTING');
    expect(h).toContain('<h1 id="cr-h1">Block printing on cotton</h1>');
    expect(h).toContain('>SUN<'); // 22 Nov 2026 is a Sunday
    expect(h).toContain('22 Nov 2026, 4:00 pm');
    expect(h).toContain('Starts in 3 days');
    expect(h).toContain('Rang Studio, Bani Park, <a href="/cities/jaipur">Jaipur</a>'); // the city links to its page
    expect(h).toContain('https://www.google.com/maps/search/?api=1&amp;query=Rang%20Studio%2C%20Bani%20Park%2C%20Jaipur');
    expect(h).toContain('8 of 12 seats left');
    expect(h).toContain('₹1,200');
    expect(h).toContain('data-reserve');
    expect(h.indexOf('data-reserve')).toBeLessThan(h.indexOf('Workshop at a glance'));
  });
  it('shows What you will make, Included and Bring only when they have content', () => {
    const h = html();
    for (const s of ['What you will make', 'A cotton tote bag', 'Printed with a border.', 'Included', 'Masala chai', 'Bring', 'Old clothes', 'Ages 14 and over']) expect(h, s).toContain(s);
    const bare = html({ makes: [], included: [], bring: [], minAge: null });
    for (const s of ['What you will make', 'Included', 'Bring', 'Ages ']) expect(bare, s).not.toContain(s);
  });
  it('a full workshop says so and offers no reservation; a free one says Free', () => {
    const full = html({ booked: 12 } as never);
    expect(full).toContain('Full');
    expect(full).not.toContain('data-reserve');
    expect(html({ type: 'FREE', pricePaise: 0 } as never)).toContain('>Free<');
  });
  it('the host card is in the first screen, before the date and the facts, and lists the channels that exist; nothing private appears', () => {
    const h = html({ contactPhone: '+919000000000', contactEmail: 'secret@x.co' } as never);
    expect(h).toContain('YOUR HOST');
    expect(h.indexOf('YOUR HOST')).toBeLessThan(h.indexOf('>WHEN<'));
    expect(h.indexOf('YOUR HOST')).toBeLessThan(h.indexOf('Workshop at a glance'));
    expect(h).not.toContain('Your host</h2>');
    expect(h).toContain('aria-label="Instagram"');
    expect(h).toContain('aria-label="WhatsApp"');
    expect(h).toContain('aria-label="Website"');
    for (const s of ['+919000000000', 'secret@x.co']) expect(h).not.toContain(s);
    expect(html({ whatsapp: null, instagram: null, website: null })).not.toContain('cr-icons');
  });
  it('with no photos it shows the illustration; with photos, the mosaic', () => {
    expect(html()).toContain('Illustration of four people making crafts together');
    expect(html({ images: ['https://img.test/a.jpg', 'https://img.test/b.jpg', 'https://img.test/c.jpg'] })).toContain('cd-mosaic-3');
  });
  it('an ended workshop says so and has no Reserve button, countdown or contact button', () => {
    const h = html({ date: '2026-11-10' }, true);
    expect(h).toContain('This event has ended.');
    expect(h).not.toContain('data-reserve');
    expect(h).not.toContain('Starts in');
  });
});

describe('the host name on the CraftDetail page', () => {
  it('links to the host profile when the host has one, and is plain text when not', () => {
    expect(html({ hostSlug: 'swati-12345678' })).toMatch(/<span class="cd-name"><a href="\/artists\/swati-12345678">[^<]+<\/a><\/span>/);
    expect(html()).not.toContain('/artists/');
  });
  it('also shows a round avatar icon beside the contact icons that opens the profile', () => {
    const h = html({ hostSlug: 'swati-12345678' });
    const a = /<a class="cd-profile"[^>]*>/.exec(h)![0];
    expect(a).toContain('href="/artists/swati-12345678"');
    expect(a).toMatch(/aria-label="View [^"]+&#x27;s profile"/);
    expect(a).toContain('title="View profile"');
    expect(h.indexOf('cd-profile')).toBeGreaterThan(h.indexOf('cd-icons'));
    expect(html()).not.toContain('cd-profile');
  });
});

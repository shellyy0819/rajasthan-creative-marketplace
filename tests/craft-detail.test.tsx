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

describe('craft and art workshop page', () => {
  it('opens with the date, the venue, the seats, the price and the Reserve button', () => {
    const h = html();
    expect(h).toContain('WORKSHOP · BLOCK PRINTING');
    expect(h).toContain('<h1 id="cr-h1">Block printing on cotton</h1>');
    expect(h).toContain('>SUN<'); // 22 Nov 2026 is a Sunday
    expect(h).toContain('22 Nov 2026, 4:00 pm');
    expect(h).toContain('Starts in 3 days');
    expect(h).toContain('Rang Studio, Bani Park, Jaipur');
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

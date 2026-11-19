import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClassDetail } from '@/components/class/ClassDetail';
import type { Workshop } from '@/lib/types';

const base = {
  id: 'w4', title: 'Sunrise Vinyasa', type: 'PAID', pricePaise: 30000, kind: 'class', mode: 'online', topicId: 1, topic: { id: 1, name: 'Yoga', slug: 'yoga' },
  city: null, cityId: null, citySlug: null, venue: null, date: '2026-11-02', time: '06:30', endsOn: '2027-02-28', seats: null, booked: 0, host: 'Anaya Sharma',
  description: 'A calm hour of flow.', status: 'APPROVED', platform: 'Zoom', schedule: { repeat: 'weekly', days: ['mon', 'tue', 'wed', 'thu', 'fri'], time: '06:30', durationMin: 60 },
  languages: ['Hindi', 'English'], level: 'beginner', experience: '8 years teaching', certifications: 'RYT 500', freeTrial: true, freeTrialDays: 2,
  whatsapp: '+919989898999', instagram: 'anaya.yoga', website: null, images: [],
  prices: [{ label: 'Single class', amountPaise: 30000, sessions: 1 }, { label: 'Monthly', amountPaise: 350000, sessions: 24 }],
} as unknown as Workshop;
const now = new Date('2026-11-18T00:30:00Z'); // Wednesday 06:00 in India
const html = (over: Partial<Workshop> = {}, ended = false, hostPhoto?: string) => renderToStaticMarkup(<ClassDetail w={{ ...base, ...over } as Workshop} ended={ended} now={now} hostPhoto={hostPhoto} />);

describe('online class page on tablets and phones (source contract)', () => {
  const css = readFileSync('src/components/class/ClassDetail.css', 'utf8').replace(/\s+/g, ' ');
  it('on tablets and phones photos are shown whole (contain); on wide screens they fill their tile (cover)', () => {
    expect(css).toMatch(/@media \(max-width: 900px\) \{[^@]*\.cd-tile img \{[^}]*object-fit: contain/);
    expect(css).toMatch(/\.cd-tile img \{ width: 100%; height: 100%; object-fit: cover/);
  });
  it('every card in the hero column has the same width (the instructor, Where, next class and booking cards line up)', () => {
    const width = (sel: string) => new RegExp(`\\${sel} \\{[^}]*max-width: 560px`).test(css);
    for (const sel of ['.cd-teacher', '.cd-next', '.cr-card']) expect(width(sel), sel).toBe(true);
    expect(readFileSync('src/components/class/CraftDetail.css', 'utf8')).toMatch(/\.cr-book \{[^}]*max-width: 560px/);
  });
  it('the photos are capped in height so the title, instructor and next class show below them', () => {
    expect(css).toMatch(/@media \(max-width: 900px\) \{[^@]*\.cd-mosaic \{[^}]*height: clamp\(220px, 42vw, 340px\)/);
    expect(css).toMatch(/@media \(max-width: 900px\) \{[^@]*\.cd-art \{[^}]*width: min\(100%, 360px\)/);
  });
});

describe('online class page', () => {
  it('shows the title, topic, instructor, trial badge, next class and the main contact button above the facts', () => {
    const h = html();
    expect(h).toContain('ONLINE CLASS · YOGA');
    expect(h).toContain('<h1 id="cd-h1">Sunrise Vinyasa</h1>');
    expect(h).toContain('Anaya Sharma');
    expect(h).toContain('8 years teaching · RYT 500');
    expect(h).toContain('2-day free trial');
    expect(h).toContain('Today, 6:30 am IST · starts in 30 min');
    expect(h).toContain('href="https://wa.me/919989898999"');
    expect(h.indexOf('Chat on WhatsApp')).toBeLessThan(h.indexOf('Class at a glance'));
  });
  it('each contact channel shows once on a wide screen: the main button sits inside the instructor card, and the icons are only the other channels', () => {
    const h = html({ whatsapp: '+919989898999', instagram: 'anaya.yoga' });
    const card = h.slice(h.indexOf('cd-teacher'), h.indexOf('cd-facts'));
    expect(card).toContain('Chat on WhatsApp');
    expect((card.match(/wa\.me/g) ?? []).length).toBe(1); // the button, not also an icon
    expect((card.match(/instagram\.com/g) ?? []).length).toBe(1); // the icon
    expect(h.slice(0, h.indexOf('cd-teacher'))).not.toContain('Chat on WhatsApp');
    const insta = html({ whatsapp: null, instagram: 'anaya.yoga' });
    const c2 = insta.slice(insta.indexOf('cd-teacher'), insta.indexOf('cd-facts'));
    expect((c2.match(/instagram\.com/g) ?? []).length).toBe(1); // only the button, no second Instagram icon next to it
    expect(c2).toContain('Open Insta');
  });
  it('the facts strip, this week, plans (with the per-class cost) and how to join come from the class data', () => {
    const h = html();
    expect(h).toContain('60 minutes');
    expect(h).toContain('2 Nov 2026 to 28 Feb 2027');
    expect(h).toContain('Live on Zoom');
    expect(h).toContain('Beginners · Hindi, English');
    expect(h).toMatch(/TODAY<\/b>/);
    expect(h).toContain('₹3,500');
    expect(h).toContain('24 sessions · about ₹146 a class');
    expect(h).toContain('Try the free class');
    expect(h).toContain('Craftofy collects no payment');
  });
  it('has a Where card in the first screen: an online class says where it is live, a class with a venue shows it with Open in Maps', () => {
    const online = html();
    expect(online).toContain('>WHERE<');
    expect(online.indexOf('>WHERE<')).toBeLessThan(online.indexOf('Class at a glance'));
    expect(online).toContain('Live on Zoom');
    expect(online).not.toContain('maps/search');
    expect(online.match(/Live on Zoom/g)?.length).toBe(1); // said once: the facts strip no longer repeats it
    const hybrid = html({ mode: 'hybrid', venue: 'Rang Studio, Bani Park', city: 'Jaipur' } as never);
    expect(hybrid).toContain('Rang Studio, Bani Park, Jaipur');
    expect(hybrid).toContain('https://www.google.com/maps/search/?api=1&amp;query=Rang%20Studio%2C%20Bani%20Park%2C%20Jaipur');
    expect(hybrid).toContain('Also live on Zoom');
  });
  it('shows the illustration when there are no photos (yoga figures for yoga, a plain arch for other topics)', () => {
    expect(html()).toContain('six people practising yoga');
    const other = html({ topic: { id: 2, name: 'Crochet', slug: 'crochet' } as never });
    expect(other).toContain('rising sun behind a Rajasthani arch');
    expect(other).not.toContain('six people');
  });
  it('one, two and three photos make a mosaic of that size, cover first, each openable', () => {
    const imgs = ['https://img.test/a.jpg', 'https://img.test/b.jpg', 'https://img.test/c.jpg'];
    const three = html({ images: imgs });
    expect(three).toContain('cd-mosaic-3');
    expect(three).toContain('Open photo 1 of 3, the cover');
    expect(three).toContain('Sunrise Vinyasa, photo 3 of 3');
    expect(three).toContain('Cover · view all 3 photos');
    expect(three).not.toContain('six people practising');
    expect(html({ images: imgs.slice(0, 2) })).toContain('cd-mosaic-2');
    const one = html({ images: imgs.slice(0, 1) });
    expect(one).toContain('cd-mosaic-1');
    expect(one).not.toContain('view all');
    expect(html({ images: [...imgs, 'https://img.test/d.jpg'] })).not.toContain('photo 4 of');
  });
  it('contact follows what is public: WhatsApp, else the shown phone, else the other channels; the private phone never appears', () => {
    expect(html({ whatsapp: null, publicPhone: '+919989898999' } as never)).toContain('href="tel:+919989898999"');
    const noPhone = html({ whatsapp: null, website: 'https://anaya.in' });
    expect(noPhone).toContain('Open Insta');
    expect(noPhone).toContain('Visit website');
    expect(noPhone).not.toContain('Chat on WhatsApp');
    const priv = html({ contactPhone: '+919000000000', contactEmail: 'secret@x.co', joinLink: 'https://zoom.us/j/1' } as never);
    for (const s of ['+919000000000', 'secret@x.co', 'zoom.us/j/1']) expect(priv).not.toContain(s);
  });
  it('the instructor card shows the seller\'s profile photo when there is one, and the initials when there is not', () => {
    const withPhoto = html({}, false, 'https://img.test/swati.jpg');
    expect(withPhoto).toMatch(/class="cd-avatar"[^>]*><img src="https:\/\/img\.test\/swati\.jpg"/);
    expect(withPhoto).not.toContain('>AS<');
    expect(html()).toContain('>AS<');
  });
  it('a free class says so, with no plan cards; an ended class has no contact button and says it ended', () => {
    const free = html({ type: 'FREE', pricePaise: 0, prices: [], freeTrial: false } as never);
    expect(free).toContain('This class is free.');
    expect(free).toContain('cd-free-badge');
    expect(free).not.toContain('cd-plan');
    expect(free).not.toContain('You pay the instructor directly');
    expect(free).toContain('Every class is free.');
    expect(free).toMatch(/cd-free-badge">Free</);
    const ended = html({ endsOn: '2026-11-10' }, true);
    expect(ended).toContain('This class has ended.');
    expect(ended).not.toContain('Chat on WhatsApp');
    expect(ended).not.toContain('NEXT CLASS');
  });
});

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
  it('the instructor, Where and next class rows live in one panel, and the booking row has the same width', () => {
    const width = (sel: string) => new RegExp(`\\${sel} \\{[^}]*max-width: 760px`).test(css);
    expect(width('.cd-panel')).toBe(true);
    expect(width('.cd-actions')).toBe(true); // the contact button (and Share beside it) under the panel is as wide as the panel, not as wide as the column // one panel holds the instructor, Where and next class rows, so they cannot differ in width
    expect(readFileSync('src/components/class/CraftDetail.css', 'utf8')).toMatch(/\.cr-book \{[^}]*max-width: 760px/);
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
    expect(h).toContain('<div class="cd-sub"><section class="cd-about" aria-label="About the instructor"><span class="cd-label cd-sub-label">About the instructor</span><div class="rich-text"><p>8 years teaching</p></div></section><section class="cd-certs" aria-label="Certifications"><span class="cd-label cd-sub-label">Certifications</span><div class="rich-text"><p>RYT 500</p></div></section></div>'); // About the instructor, then Certifications set apart
    expect(html({ certifications: null } as Partial<Workshop>)).not.toContain('Certifications</span>'); // no certifications, no heading
    expect(html({ experience: null } as Partial<Workshop>)).not.toContain('About the instructor'); // no about text, no heading
    expect(html({ experience: null, certifications: '1. RYT' } as Partial<Workshop>)).toContain('cd-sub-label">Certifications</span><div class="rich-text"><ol>');
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
    expect(h).toContain('Upcoming classes');
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

describe('upcoming classes on the online class page', () => {
  it('lists the next four classes with their weekday, date, time and a tag, the first picked out', () => {
    const h = html();
    expect(h).toContain('Upcoming classes');
    expect(h).not.toContain('This week');
    expect((h.match(/class="cd-up-item/g) ?? []).length).toBe(4);
    expect(h).toContain('cd-up-item cd-up-first');
    expect(h).toContain('<span class="cd-up-tag">Today</span>');
    expect(h).toContain('Wednesday<span class="cd-up-rest"> 18 Nov</span>');
    expect(h).toContain('6:30 am IST');
    expect(h).toContain('Times are India time (IST).');
    expect(h).not.toContain('Rest'); // no box for a day without a class
  });
  it('a class that has not started yet lists its first dates, tagged by how far away they are', () => {
    const h = html({ date: '2026-12-07', endsOn: '2027-02-28' } as Partial<Workshop>);
    expect(h).toContain('Monday<span class="cd-up-rest"> 7 Dec</span>');
    expect(h).toContain('In 19 days');
  });
  it('a class with one date left lists just that one, and an ended class has no list', () => {
    expect((html({ endsOn: '2026-11-18' } as Partial<Workshop>).match(/class="cd-up-item/g) ?? []).length).toBe(1);
    expect(html({}, true)).not.toContain('Upcoming classes');
  });
});

describe('the upcoming list styling (source contract)', () => {
  const css = readFileSync('src/components/class/ClassDetail.css', 'utf8').replace(/\s+/g, ' ');
  it('is four cards across on a laptop and rows on a phone, with the next class in green and an orange tag', () => {
    expect(css).toMatch(/\.cd-up \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(/\.cd-up-first \{ border-color: var\(--green\); background: var\(--chip-green\); \}/);
    expect(css).toMatch(/\.cd-up-first \.cd-up-tag \{[^}]*background: var\(--orange\); color: #fffdf9;/);
    expect(css).toMatch(/@media \(max-width: 700px\) \{ \.cd-up \{ grid-template-columns: minmax\(0, 1fr\);/);
    expect(css).not.toContain('.cd-week');
  });
});

describe('the instructor card styling (source contract)', () => {
  const css = readFileSync('src/components/class/ClassDetail.css', 'utf8').replace(/\s+/g, ' ');
  it('sets the certifications apart under a rule, with a check on each bullet, from tokens only', () => {
    expect(css).toMatch(/\.cd-certs \{ margin-top: 12px; border-top: 1px solid var\(--line\); \}/);
    expect(css).toMatch(/\.cd-certs \.rich-text ul \{ list-style: none;/);
    expect(css).toMatch(/\.cd-certs \.rich-text ul li::before \{[^}]*content: '\\2713'[^}]*color: var\(--green-d\)/);
  });
  it('the in-person page uses the same card parts, headed "About the host"', () => {
    const src = readFileSync('src/components/class/CraftDetail.tsx', 'utf8');
    expect(src).toContain('<InstructorBio experience={w.experience} certifications={w.certifications} who="host" />');
  });
});

describe('the contact button and Share share one row (source contract)', () => {
  const css = readFileSync('src/components/class/ClassDetail.css', 'utf8').replace(/\s+/g, ' ');
  it('Share sits beside the contact button, as tall as it, and the left column is the wider one', () => {
    expect(css).toMatch(/\.cd-hero \{[^}]*grid-template-columns: minmax\(0, 8fr\) minmax\(0, 5fr\)/);
    expect(css).toMatch(/\.cd-actions \{ display: flex; align-items: flex-start;/);
    expect(css).toMatch(/\.cd-actions \.share-slot \{ flex: none; margin-top: 0; \}/);
    expect(css).toMatch(/\.cd-actions \.share-btn, \.cd-aside \.share-btn \{ min-height: 48px; \}/);
    expect(css).toMatch(/\.cd-actions > \.cd-cta \{ display: none; \}/); // phones keep the fixed bottom bar for the contact button
  });
  it('the page puts the contact button and Share in the same row', () => {
    const src = readFileSync('src/components/class/ClassDetail.tsx', 'utf8').replace(/\s+/g, ' ');
    expect(src).toMatch(/<div className=\{`cd-actions[^`]*`\}> \{!ended && ch\.primary && <div className="cd-cta">[\s\S]*?<\/div>\} \{share && <div className="share-slot">/);
  });
});

describe('the photo is level with the panel and the buttons (source contract)', () => {
  const css = readFileSync('src/components/class/ClassDetail.css', 'utf8').replace(/\s+/g, ' ');
  it('on wide screens the photo sits in the row of the panel and buttons, filling that row without making it taller', () => {
    expect(css).toMatch(/@media \(min-width: 901px\) \{ \.cd-hero-aligned \{ grid-template-rows: auto auto; align-items: stretch;/);
    expect(css).toMatch(/\.cd-hero-aligned \.cd-hero-body \{ grid-column: 1; grid-row: 2; \}/);
    expect(css).toMatch(/\.cd-hero-aligned \.cd-media \{ grid-column: 2; grid-row: 2; position: relative;/);
    expect(css).toMatch(/\.cd-hero-aligned \.cd-mosaic \{ position: absolute; inset: 0; aspect-ratio: auto; \}/);
  });
  it('the page puts the panel and the buttons in one body block beside the photo', () => {
    const src = readFileSync('src/components/class/ClassDetail.tsx', 'utf8').replace(/\s+/g, ' ');
    expect(src).toContain('<section className="cd-hero cd-hero-aligned"');
    expect(src).toMatch(/<div className="cd-hero-body"> <div className="cd-panel">/);
  });
});

describe('the phone bottom bar (source contract)', () => {
  const css = readFileSync('src/components/class/ClassDetail.css', 'utf8').replace(/\s+/g, ' ');
  it('is a solid bar fixed at the bottom of the screen, above the home indicator, so the page does not show through it, with the same space (12px) above and below the buttons', () => {
    expect(css).toMatch(/@media \(max-width: 700px\) \{[^@]*\.cd-aside \{[^}]*position: fixed; left: 0; right: 0; bottom: 0;[^}]*border-style: solid; border-color: var\(--line\); border-width: 1px 0 0; background: var\(--paper\); padding: 12px 16px calc\(12px \+ env\(safe-area-inset-bottom\)\);/);
  });
  it('holds Share beside the contact button, as tall as it, and hides the other Share while the bar is showing', () => {
    expect(css).toMatch(/\.cd-aside-row \{ display: flex; align-items: flex-start; gap: 10px; \}/);
    expect(css).toMatch(/\.cd-aside-row \.cd-btn \{ flex: 1 1 auto; min-width: 0; \}/);
    expect(css).toMatch(/\.cd-actions \.share-btn, \.cd-aside \.share-btn \{ min-height: 48px; \}/);
    expect(css).toMatch(/\.cd-actions-has-bar \{ display: none; \}/);
  });
  it('the page renders Share in the bar, and marks the in-page row so it can be hidden only when the bar exists', () => {
    const src = readFileSync('src/components/class/ClassDetail.tsx', 'utf8').replace(/\s+/g, ' ');
    expect(src).toMatch(/<div className="cd-aside-row"> <Button c=\{ch\.primary\} \/> \{share && <div className="share-slot">\{share\}<\/div>\} <\/div>/);
    expect(src).toContain("cd-actions${!ended && ch.primary ? ' cd-actions-has-bar' : ''}");
  });
});

describe('the instructor logo on phones (source contract)', () => {
  const css = readFileSync('src/components/class/ClassDetail.css', 'utf8').replace(/\s+/g, ' ');
  it('is centred above the name and details, which then use the full card width', () => {
    expect(css).toMatch(/@media \(max-width: 700px\) \{[^@]*\.cd-teacher \{ grid-template-columns: minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.cd-teacher > \.cd-avatar \{ justify-self: center; width: 56px; height: 56px; \}/);
  });
  it('the logo comes first in the row, before the YOUR INSTRUCTOR label (so it is above it when the row stacks)', () => {
    const h = renderToStaticMarkup(<ClassDetail w={{ ...base } as Workshop} ended={false} now={now} />);
    expect(h.indexOf('class="cd-avatar"')).toBeGreaterThan(-1);
    expect(h.indexOf('class="cd-avatar"')).toBeLessThan(h.indexOf('YOUR INSTRUCTOR'));
  });
});

describe('the free trial chip on the picture', () => {
  it('sits inside the picture box, once, and the old badge under the title is gone', () => {
    const photo = html({ images: ['https://example.com/a.jpg'] } as Partial<Workshop>);
    expect(photo).toMatch(/<div class="cd-media"><span class="cd-trial-chip">2-day free trial<\/span><div class="cd-mosaic/);
    expect((photo.match(/2-day free trial/g) ?? []).length).toBe(1);
    expect(photo).not.toContain('cd-badges');
    const art = html({ images: [] } as Partial<Workshop>);
    expect(art).toMatch(/<div class="cd-media"><span class="cd-trial-chip">2-day free trial<\/span><div class="cd-art">/);
  });
  it('says Free trial when no length is given, and a class without a trial has no chip', () => {
    expect(html({ freeTrialDays: null } as Partial<Workshop>)).toContain('cd-trial-chip">Free trial<');
    expect(html({ freeTrial: false, freeTrialDays: null } as Partial<Workshop>)).not.toContain('cd-trial-chip');
  });
  it('is the site\'s orange chip with white text, at the top left of the picture (source contract)', () => {
    const css = readFileSync('src/components/class/ClassDetail.css', 'utf8').replace(/\s+/g, ' ');
    expect(css).toMatch(/\.cd-media \{ min-width: 0; position: relative; \}/);
    expect(css).toMatch(/\.cd-trial-chip \{ position: absolute; left: 12px; top: 12px;[^}]*background: var\(--orange\); color: #fffdf9;/);
  });
});

describe('How to join on phones (source contract)', () => {
  const css = readFileSync('src/components/class/ClassDetail.css', 'utf8').replace(/\s+/g, ' ');
  it('puts each step on one line with its number: number left, title level with it, sentence under the title', () => {
    expect(css).toMatch(/@media \(max-width: 700px\) \{[^@]*\.cd-steps li \{ display: grid; grid-template-columns: 32px minmax\(0, 1fr\); align-items: start; gap: 14px; padding: 16px; \}/);
    expect(css).toMatch(/\.cd-steps strong \{ line-height: 32px; margin-bottom: 0; \}/);
  });
  it('uses the site\'s sizes: 12px bold number, 18px step title, 12px sentence', () => {
    expect(css).toMatch(/\.cd-steps b \{[^}]*font: 700 12px var\(--font-sans\);/);
    expect(css).toMatch(/\.cd-steps strong \{ display: block; font: 500 18px var\(--font-display\);/);
    expect(css).toMatch(/\.cd-steps span \{ font-size: 12px; line-height: 1\.6;/);
  });
});

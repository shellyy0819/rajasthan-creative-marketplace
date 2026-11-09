// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
const track = vi.hoisted(() => ({ sendEvent: vi.fn(), gaEvent: vi.fn() }));
vi.mock('@/lib/track', () => ({ sendEvent: track.sendEvent }));
vi.mock('@/lib/analytics', () => ({ gaEvent: track.gaEvent }));
import { ArtistHero, sharedCategory } from '@/components/ArtistHero';
import { readCss } from './helpers/css';
import type { Product } from '@/lib/types';

afterEach(cleanup);
const prod = (n: number, over: Partial<Product> = {}): Product => ({
  id: `p${n}`, name: `Piece ${n}`, category: 'Crochet', city: 'Udaipur', cityId: 1, citySlug: 'udaipur', pricePaise: 210000 + n * 100,
  seller: 'Shauk and Stuff', description: 'd', stock: 3, status: 'APPROVED', sellerSlug: 'shauk-12345678', ...over,
});
const artist = (n: number, over: Record<string, unknown> = {}, pOver: Partial<Product> = {}) => ({
  name: 'Shauk and Stuff', slug: 'shauk-12345678', city: 'Udaipur', bio: 'Hand-crocheted frocks.', phone: '+91 99898 98999', email: 'a@b.co',
  instagram: '@shauk', youtube: '@shaukyt', products: Array.from({ length: n }, (_, i) => prod(i + 1, { phone: '+91 99898 98999', email: 'a@b.co', instagram: '@shauk', youtube: '@shaukyt', ...pOver })), ...over,
});
const hero = (a = artist(3)) => render(<ArtistHero a={a} />);

describe('ArtistHero', () => {
  it('has the single h1 with the name, the MEET THE MAKER eyebrow, and a decorative awning and monogram', () => {
    hero();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Shauk and Stuff');
    expect(screen.getByText('MEET THE MAKER')).toBeTruthy();
    expect(document.querySelector('.ah-awning')!.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.stall-awning')).toBeTruthy();
    const av = document.querySelector('.ah-avatar')!;
    expect(av.textContent).toBe('S');
    expect(av.getAttribute('aria-hidden')).toBe('true');
  });
  it('chips: city with a pin only when present, category only when shared, piece count', () => {
    hero();
    const chips = document.querySelector('.ah-chips')!;
    expect(chips.textContent).toBe('UdaipurCrochet3 pieces');
    expect(chips.querySelector('.ah-ico')).toBeTruthy();
    cleanup();
    const a = artist(2, { city: undefined });
    a.products[1] = prod(2, { category: 'Pottery' });
    hero(a);
    const c2 = document.querySelector('.ah-chips')!;
    expect(c2.textContent).toBe('2 pieces');   // no city, categories differ: neither chip
    cleanup();
    hero(artist(1));
    expect(document.querySelector('.ah-chips')!.textContent).toBe('UdaipurCrochet1 piece');
    expect(sharedCategory([prod(1), prod(2), prod(3, { category: 'Pottery' })])).toBe('Crochet');
    expect(sharedCategory([prod(1), prod(2, { category: 'Pottery' })])).toBeUndefined();
  });
  it('the hero Contact artist is artist-level: no "About <product>" line, no View all link, event tagged source=artist', () => {
    hero();
    fireEvent.click(screen.getByRole('button', { name: 'Contact artist' }));
    const d = screen.getByRole('dialog');
    expect(d.textContent).not.toContain('About:');
    expect(within(d).queryByRole('link', { name: /View all/ })).toBeNull();
    expect(track.sendEvent).toHaveBeenCalledWith('contact', 'p1', 'artist');
    expect(track.gaEvent).toHaveBeenCalledWith('contact_click', { item_id: 'p1', source: 'artist' });
  });
  it('shows the bio only when there is one', () => {
    hero();
    expect(document.querySelector('.ah-bio')!.textContent).toBe('Hand-crocheted frocks.');
    cleanup();
    hero(artist(3, { bio: undefined }));
    expect(document.querySelector('.ah-bio')).toBeNull();
  });
  it('the Instagram button exists only with an instagram handle, opens a new tab safely', () => {
    hero();
    const ig = screen.getByRole('link', { name: 'Instagram ↗' });
    expect(ig.getAttribute('href')).toBe('https://www.instagram.com/shauk/');
    expect(ig.getAttribute('target')).toBe('_blank');
    expect(ig.getAttribute('rel')).toBe('noreferrer');
    cleanup();
    hero(artist(3, { instagram: undefined }));
    expect(screen.queryByRole('link', { name: 'Instagram ↗' })).toBeNull();
  });
  it('contact details stay reachable: a Contact artist dialog plus phone, email and YouTube links', () => {
    hero();
    fireEvent.click(screen.getByRole('button', { name: 'Contact artist' }));
    expect(within(screen.getByRole('dialog')).getByText('+91 99898 98999')).toBeTruthy();
    cleanup();
    hero();
    const links = document.querySelector('.ah-links')!;
    expect(links.querySelector('a[href="tel:+919989898999"]')).toBeTruthy();
    expect(links.querySelector('a[href="mailto:a@b.co"]')).toBeTruthy();
    expect(links.querySelector('a[href="https://www.youtube.com/@shaukyt"]')).toBeTruthy();
    cleanup();
    hero(artist(3, { phone: undefined, email: undefined, youtube: undefined }));
    expect(document.querySelector('.ah-links')).toBeNull();
  });
  it.each([[1, 1], [2, 2], [3, 3], [5, 3]])('%i products render %i hero cards, each a link with name and price and an accessible name', (n, cards) => {
    hero(artist(n));
    const els = document.querySelectorAll('a.ah-card');
    expect(els).toHaveLength(cards);
    expect(els[0].getAttribute('href')).toBe('/products/piece-1-p1');
    expect(els[0].querySelector('.ah-ptag')!.textContent).toBe('₹2,101');
    expect(els[0].querySelector('.ah-cname')!.textContent).toBe('Piece 1');
    expect(screen.getByRole('link', { name: /Piece 1.*₹2,101/ })).toBeTruthy();
    expect(document.querySelector('.ah-row')!.getAttribute('data-count')).toBe(String(cards));
  });
});

describe('ArtistHero avatar logo', () => {
  const LOGO = 'https://bucket.s3.ap-south-1.amazonaws.com/logos/u1/a.png';
  it('shows the uploaded logo as a decorative round image when the artist has one', () => {
    const { container } = hero(artist(3, { logoUrl: LOGO }));
    const img = container.querySelector('.ah-avatar img.ah-logo') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(LOGO);
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img.getAttribute('loading')).not.toBe('lazy'); // above the fold
    expect(container.querySelector('.ah-avatar')!.textContent).toBe('');
    expect(container.querySelector('.ah-avatar')!.getAttribute('aria-hidden')).toBe('true');
  });
  it('shows the initial when there is no logo', () => {
    const { container } = hero(artist(3));
    expect(container.querySelector('.ah-avatar img')).toBeNull();
    expect(container.querySelector('.ah-avatar')!.textContent).toBe('S');
  });
  it('falls back to the initial when the logo cannot be loaded', () => {
    const { container } = hero(artist(3, { logoUrl: LOGO }));
    fireEvent.error(container.querySelector('.ah-avatar img')!);
    expect(container.querySelector('.ah-avatar img')).toBeNull();
    expect(container.querySelector('.ah-avatar')!.textContent).toBe('S');
  });
  it('crops the logo to the round avatar', () => {
    const css = readCss();
    expect(css).toMatch(/\.ah-avatar\{[^}]*overflow:hidden/);
    expect(css).toMatch(/\.ah-logo\{[^}]*object-fit:cover/);
  });
});

describe('artist hero CSS contract', () => {
  const css = readCss();
  it('phone: two columns, last odd card spans, bio clamps to three lines, 44px buttons', () => {
    const phone = css.slice(css.indexOf('@media(max-width:600px){.artist-hero{'));
    expect(phone).toContain('.ah-row,.ah-row[data-count]{grid-template-columns:1fr 1fr');
    expect(phone).toContain('.ah-card:last-child:nth-child(odd){grid-column:1 / -1;justify-self:center;width:calc((100% - 16px) / 2)}');
    expect(phone).toMatch(/\.ah-bio\{[^}]*-webkit-line-clamp:3/);
    expect(css).toMatch(/\.ah-acts \.contact-btn,\.ah-acts \.ah-ig\{[^}]*min-height:44px/);
  });
  it('laptop: cards are capped at 240px for 1, 2 and 3; unused artist CSS is gone', () => {
    expect(css).toMatch(/\.ah-row\{[^}]*grid-template-columns:repeat\(3,minmax\(0,240px\)\);justify-content:center/);
    expect(css).toContain('.ah-row[data-count="1"]{grid-template-columns:minmax(0,240px)}');
    expect(css).toContain('.ah-row[data-count="2"]{grid-template-columns:repeat(2,minmax(0,240px))}');
    expect(css).toMatch(/\.ah-card:hover \.ah-cname\{text-decoration:underline/);
    expect(css).not.toContain('.artist-contact');
    expect(css).not.toContain('.artist-city');
  });
  it('price tag: chalk token paper, rotated 3deg, top right, with a hole; name clamps to two lines', () => {
    expect(css).toMatch(/\.ah-ptag\{[^}]*right:-6px;top:14px[^}]*background:var\(--stall-chalk\)[^}]*transform:rotate\(3deg\)/);
    expect(css).toMatch(/\.ah-hole\{[^}]*border-radius:50%/);
    expect(css).toMatch(/\.ah-cname\{[^}]*-webkit-line-clamp:2[^}]*font-size:13px/);
  });
});

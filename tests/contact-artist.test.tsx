// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
const track = vi.hoisted(() => ({ sendEvent: vi.fn(), gaEvent: vi.fn() }));
vi.mock('@/lib/track', () => ({ sendEvent: track.sendEvent }));
vi.mock('@/lib/analytics', () => ({ gaEvent: track.gaEvent }));
import { ContactArtistButton } from '@/components/ContactArtistButton';
import { instagramHandle, instagramUrl, youtubeUrl } from '@/lib/social';
import type { Product } from '@/lib/types';

const P: Product = {
  id: 'p1', name: 'Crochet Lily Bouquet', category: 'Crochet', city: 'Jaipur', cityId: 1, citySlug: 'jaipur', pricePaise: 100000, seller: 'Shauk and Stuff',
  description: 'd', stock: 3, status: 'APPROVED', phone: '+91 99898 98999', email: 'hello@shauk.example', instagram: '@shaukandstuff',
  youtube: '@shaukandstuff', artistBio: 'Third-generation maker.\nCrochet from Jaipur.', artistCity: 'Jaipur', sellerSlug: 'shauk-and-stuff-6b13cbf3',
};
beforeEach(() => { track.sendEvent.mockClear(); track.gaEvent.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const open = (p = P) => { render(<ContactArtistButton product={p} />); fireEvent.click(screen.getByRole('button', { name: 'Contact artist' })); return screen.getByRole('dialog'); };

describe('social helpers', () => {
  it('build safe profile urls from handles, @handles and full urls', () => {
    expect(instagramUrl('@shaukandstuff')).toBe('https://www.instagram.com/shaukandstuff/');
    expect(instagramUrl('https://www.instagram.com/shauk/')).toBe('https://www.instagram.com/shauk/');
    expect(instagramUrl('a b/../c')).toBe('https://www.instagram.com/a%20b%2F..%2Fc/');
    expect(instagramUrl('instagram.com/shauk')).toBe('https://www.instagram.com/shauk/');
    expect(instagramUrl('www.instagram.com/shauk/?igsh=abc#x')).toBe('https://www.instagram.com/shauk/');
    expect(instagramUrl(' https://instagram.com/shauk/reels/ ')).toBe('https://www.instagram.com/shauk/');
    expect(instagramHandle('https://www.instagram.com/shauk/?hl=en')).toBe('@shauk');
    expect(instagramHandle('@shauk')).toBe('@shauk');
    expect(instagramHandle('shauk')).toBe('@shauk');
    expect(youtubeUrl('@shauk')).toBe('https://www.youtube.com/@shauk');
    expect(youtubeUrl('https://youtu.be/xyz')).toBe('https://youtu.be/xyz');
    expect(youtubeUrl('javascript:alert(1)')).toBe('https://www.youtube.com/@javascript%3Aalert(1)');
  });
});

describe('ContactArtistButton', () => {
  it('is a button that announces a dialog; nothing is open until it is pressed; no Add to bag anywhere', () => {
    render(<ContactArtistButton product={P} />);
    const b = screen.getByRole('button', { name: 'Contact artist' }) as HTMLButtonElement;
    expect(b.type).toBe('button');
    expect(b.getAttribute('aria-haspopup')).toBe('dialog');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Add to bag/i);
  });
  it('opens a modal sheet with the artist, city, bio, the product asked about and every shared detail', () => {
    const d = open();
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(within(d).getByRole('heading', { name: 'Shauk and Stuff' })).toBeTruthy();
    expect(d.textContent).toContain('Jaipur');
    expect(d.textContent).toContain('Third-generation maker.');
    expect(d.textContent).toContain('Crochet from Jaipur.');
    expect(d.textContent).toContain('Crochet Lily Bouquet');
    for (const v of ['+91 99898 98999', 'hello@shauk.example', '@shaukandstuff']) expect(d.textContent).toContain(v);
  });
  it('links are real and safe: tel/mailto, social profiles in a new tab with noreferrer, artist page keeps ?from=', () => {
    const d = open();
    expect(within(d).getByRole('link', { name: /Call/ }).getAttribute('href')).toBe('tel:+919989898999');
    expect(within(d).getByRole('link', { name: /Email/ }).getAttribute('href')).toBe('mailto:hello@shauk.example');
    const ig = within(d).getByRole('link', { name: /Instagram/ });
    expect(ig.getAttribute('href')).toBe('https://www.instagram.com/shaukandstuff/');
    expect(ig.getAttribute('target')).toBe('_blank'); expect(ig.getAttribute('rel')).toContain('noreferrer');
    expect(within(d).getByRole('link', { name: /YouTube/ }).getAttribute('href')).toBe('https://www.youtube.com/@shaukandstuff');
    expect(within(d).getByRole('link', { name: /View all by Shauk and Stuff/ }).getAttribute('href')).toBe('/artists/shauk-and-stuff-6b13cbf3?from=p1');
  });
  it('records one contact click when it opens (first-party and GA), none before', () => {
    render(<ContactArtistButton product={P} />);
    expect(track.sendEvent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Contact artist' }));
    expect(track.sendEvent).toHaveBeenCalledTimes(1);
    expect(track.sendEvent).toHaveBeenCalledWith('contact', 'p1');
    expect(track.gaEvent).toHaveBeenCalledWith('contact_click', { item_id: 'p1' });
  });
  it('hides what the artist did not share and shows an honest empty state when nothing is shared', () => {
    let d = open({ ...P, email: undefined, instagram: undefined, youtube: undefined, artistBio: undefined, artistCity: undefined });
    expect(within(d).queryByRole('link', { name: /Email/ })).toBeNull();
    expect(within(d).queryByRole('link', { name: /Instagram/ })).toBeNull();
    expect(within(d).getByRole('link', { name: /Call/ })).toBeTruthy();
    cleanup();
    d = open({ ...P, phone: undefined, email: undefined, instagram: undefined, youtube: undefined });
    expect(d.textContent).toContain('This artist has not shared contact details yet.');
    expect(within(d).getByRole('link', { name: /View all by Shauk and Stuff/ })).toBeTruthy();
  });
  it('product mode (default) keeps the About line and View all link and logs a plain product event', () => {
    const d = open();
    expect(d.textContent).toContain('About:');
    expect(within(d).getByRole('link', { name: /View all/ })).toBeTruthy();
    expect(track.sendEvent.mock.calls[0]).toEqual(['contact', 'p1']);
  });
  it('artistLevel mode hides the About line and View all link and tags the events source=artist', () => {
    render(<ContactArtistButton product={P} artistLevel />);
    fireEvent.click(screen.getByRole('button', { name: 'Contact artist' }));
    const d = screen.getByRole('dialog');
    expect(d.textContent).not.toContain('About:');
    expect(within(d).queryByRole('link', { name: /View all/ })).toBeNull();
    expect(d.textContent).toContain('+91 99898 98999');
    expect(track.sendEvent).toHaveBeenCalledWith('contact', 'p1', 'artist');
    expect(track.gaEvent).toHaveBeenCalledWith('contact_click', { item_id: 'p1', source: 'artist' });
  });
  it('without an artist page slug there is no "View all" link', () => {
    const d = open({ ...P, sellerSlug: undefined });
    expect(within(d).queryByRole('link', { name: /View all/ })).toBeNull();
  });
  it('renders the bio as text (no markup injection) and keeps its line breaks', () => {
    const d = open({ ...P, artistBio: '<img src=x onerror=alert(1)>\nSecond line' });
    expect(d.querySelector('img')).toBeNull();
    expect(d.textContent).toContain('<img src=x onerror=alert(1)>');
    expect((d.querySelector('.contact-bio') as HTMLElement).className).toContain('contact-bio');
  });
  it('Copy writes the value to the clipboard and says Copied; falls back to Selected when the clipboard is refused', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const d = open();
    fireEvent.click(within(d).getByRole('button', { name: 'Copy phone' }));
    expect(writeText).toHaveBeenCalledWith('+91 99898 98999');
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Copy phone' }).textContent).toBe('Copied'));
    writeText.mockRejectedValue(new Error('refused'));
    fireEvent.click(within(d).getByRole('button', { name: 'Copy email' }));
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Copy email' }).textContent).toBe('Selected'));
  });
  it('closes with the close button, Escape and a tap on the backdrop (not on the card) and returns focus to the button', () => {
    const d = open();
    const trigger = screen.getByRole('button', { name: 'Contact artist' });
    fireEvent.click(d); // inside the card: stays open
    expect(screen.queryByRole('dialog')).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger); expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(document.querySelector('.contact-backdrop')!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('opens even for a sold-out product (the conversation is the point)', () => {
    const d = open({ ...P, stock: 0 });
    expect(d).toBeTruthy();
  });
});

describe('Add to bag is gone from the whole storefront (source contract)', () => {
  it('cards and the product page use ContactArtistButton and nothing references the cart button', async () => {
    const fs = await import('node:fs');
    for (const f of ['src/components/ProductCard.tsx', 'src/app/products/[slug]/page.tsx']) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src).toContain('<ContactArtistButton product={p} />');
      expect(src).not.toMatch(/AddToCart|Add to bag|Demo checkout/);
    }
    expect(fs.existsSync('src/components/AddToCartButton.tsx')).toBe(false);
  });
});

describe('Instagram handle opens in a new tab', () => {
  it('the handle shown in the contact dialog is itself a link to the profile, in a new tab, next to the Open Instagram button', () => {
    const d = open();
    const handle = within(d).getByRole('link', { name: '@shaukandstuff' });
    expect(handle.getAttribute('href')).toBe('https://www.instagram.com/shaukandstuff/');
    expect(handle.getAttribute('target')).toBe('_blank');
    expect(handle.getAttribute('rel')).toContain('noreferrer');
    expect(within(d).getByRole('link', { name: /Open Instagram/ }).getAttribute('target')).toBe('_blank');
  });
  it('a full profile url typed by the artist is shown as a clean @handle', () => {
    const d = open({ ...P, instagram: 'https://www.instagram.com/shauk/?igsh=1' });
    expect(within(d).getByRole('link', { name: '@shauk' }).getAttribute('href')).toBe('https://www.instagram.com/shauk/');
  });
});

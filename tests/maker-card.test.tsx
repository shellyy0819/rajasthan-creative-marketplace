// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MakerCard } from '@/components/MakerCard';
import { publicWhatsappOf } from '@/db/mappers';
import { whatsappUrl } from '@/lib/social';
import type { Product } from '@/lib/types';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
const sendEvent = vi.fn();
vi.mock('@/lib/track', () => ({ sendEvent: (...a: unknown[]) => sendEvent(...a) }));
const gaContactSeller = vi.fn();
vi.mock('@/lib/ga-events', () => ({ gaContactSeller: (...a: unknown[]) => gaContactSeller(...a) }));

afterEach(() => { cleanup(); sendEvent.mockClear(); gaContactSeller.mockClear(); });

const product = (extra: Partial<Product> = {}): Product => ({
  id: 'p1', name: 'Crochet flower tie-back', category: 'Crochet', city: 'Jaipur', cityId: 1, citySlug: 'jaipur', pricePaise: 100000,
  seller: 'Meera Textile Studio', description: 'd', stock: 2, status: 'APPROVED', sellerSlug: 'meera-textile-studio-abc', artistCity: 'Jaipur', ...extra,
});

describe('publicWhatsappOf: only when WhatsApp is a chosen method', () => {
  it('shows the number when whatsapp is among the methods', () => expect(publicWhatsappOf('9876543210', ['whatsapp', 'phone'])).toBe('9876543210'));
  it('hides it when whatsapp is not chosen', () => expect(publicWhatsappOf('9876543210', ['phone'])).toBeUndefined());
  it('hides it when no methods are saved at all', () => expect(publicWhatsappOf('9876543210', [])).toBeUndefined());
  it('hides it when there is no number', () => {
    expect(publicWhatsappOf(null, ['whatsapp'])).toBeUndefined();
    expect(publicWhatsappOf('', ['whatsapp'])).toBeUndefined();
  });
});

describe('whatsappUrl', () => {
  it('adds the country code to a 10-digit number and encodes the message', () => {
    const u = new URL(whatsappUrl('98765 43210', 'Hi Meera & co, ₹1,000?'));
    expect(u.origin + u.pathname).toBe('https://wa.me/919876543210');
    expect(u.searchParams.get('text')).toBe('Hi Meera & co, ₹1,000?');
  });
  it('accepts +91, 91 and 0 prefixes without doubling the code', () => {
    for (const n of ['+91 98765 43210', '919876543210', '09876543210']) expect(whatsappUrl(n, 'x')).toContain('wa.me/919876543210?');
  });
});

describe('MakerCard', () => {
  it('leads with Message on WhatsApp, prefilled with the maker, product and price', () => {
    render(<MakerCard product={product({ whatsapp: '9876543210', phone: '9123456789', email: 'm@x.co', instagram: '@meera', youtube: '@meeratv' })} />);
    const wa = screen.getByRole('link', { name: /message on whatsapp/i });
    expect(wa.getAttribute('href')).toContain('wa.me/919876543210');
    const text = new URL(wa.getAttribute('href')!).searchParams.get('text')!;
    expect(text).toBe('Meera Textile Studio I saw Crochet flower tie-back (₹1,000) on Craftofy and I’m interested.');
    expect(screen.getByText(/your message will start with/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /call/i }).getAttribute('href')).toBe('tel:9123456789');
    expect(screen.getByRole('link', { name: /email/i }).getAttribute('href')).toBe('mailto:m@x.co');
    expect(screen.getByRole('link', { name: /instagram/i }).getAttribute('href')).toContain('instagram.com/meera');
    expect(screen.getByRole('link', { name: /youtube/i }).getAttribute('href')).toContain('youtube.com');
    expect(screen.getByRole('link', { name: /Meera Textile Studio/ }).getAttribute('href')).toBe('/artists/meera-textile-studio-abc?from=p1');
  });

  it('falls back to the public phone for WhatsApp when no WhatsApp number is shared', () => {
    render(<MakerCard product={product({ phone: '9123456789' })} />);
    expect(screen.getByRole('link', { name: /message on whatsapp/i }).getAttribute('href')).toContain('wa.me/919123456789');
  });

  it('with no phone either, the first shared method becomes the main button and there is no WhatsApp line', () => {
    render(<MakerCard product={product({ email: 'm@x.co', instagram: '@meera' })} />);
    expect(screen.queryByRole('link', { name: /whatsapp/i })).toBeNull();
    expect(screen.queryByText(/your message will start with/i)).toBeNull();
    expect(screen.getByRole('link', { name: /email/i }).className).toContain('primary');
    expect(screen.getByRole('link', { name: /instagram/i }).className).not.toContain('primary');
  });

  it('says so when the maker shares nothing, and never shows a dead link', () => {
    render(<MakerCard product={product()} />);
    expect(screen.getByText(/has not shared contact details yet/i)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /whatsapp|call|email|instagram|youtube/i })).toBeNull();
  });

  it('a price-less product says "Price on request" in the message', () => {
    render(<MakerCard product={product({ whatsapp: '9876543210', pricePaise: null })} />);
    const text = new URL(screen.getByRole('link', { name: /whatsapp/i }).getAttribute('href')!).searchParams.get('text')!;
    expect(text).toContain('(Price on request)');
  });

  it('records each click: WhatsApp as a contact, others by method; GA hears the method', () => {
    render(<MakerCard product={product({ whatsapp: '9876543210', phone: '9123456789', email: 'm@x.co' })} />);
    fireEvent.click(screen.getByRole('link', { name: /message on whatsapp/i }));
    expect(sendEvent).toHaveBeenLastCalledWith('contact', 'p1');
    expect(gaContactSeller).toHaveBeenLastCalledWith({ sellerSlug: 'meera-textile-studio-abc', method: 'whatsapp', productId: 'p1' });
    fireEvent.click(screen.getByRole('link', { name: /email/i }));
    expect(sendEvent).toHaveBeenLastCalledWith('contact_email', 'p1');
    expect(gaContactSeller).toHaveBeenLastCalledWith({ sellerSlug: 'meera-textile-studio-abc', method: 'email', productId: 'p1' });
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InstagramMessageButton } from '@/components/InstagramMessageButton';
import { instagramDmUrl } from '@/lib/social';
import type { Product } from '@/lib/types';

const sendEvent = vi.fn();
vi.mock('@/lib/track', () => ({ sendEvent: (...a: unknown[]) => sendEvent(...a) }));
const gaContactSeller = vi.fn();
vi.mock('@/lib/ga-events', () => ({ gaContactSeller: (...a: unknown[]) => gaContactSeller(...a) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sendEvent.mockClear(); gaContactSeller.mockClear(); });

const P: Product = { id: 'p1', name: 'Vase', category: 'Pottery', city: 'Jaipur', cityId: 1, citySlug: 'jaipur', pricePaise: 100000, seller: 'Studio A', description: 'd', stock: 1, status: 'APPROVED', instagram: '@studio.a', sellerSlug: 'studio-a-1' };
const open = () => { render(<InstagramMessageButton product={P} productUrl="https://craftofy.online/products/vase-p1" className="button maker-chip">Instagram</InstagramMessageButton>); fireEvent.click(screen.getByRole('button', { name: /instagram/i })); return screen.getByRole('dialog'); };
const link = () => screen.getByRole('link', { name: /copy message/i }) as HTMLAnchorElement;
const stubClipboard = (impl: () => Promise<void>) => { const writeText = vi.fn(impl); Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true }); return writeText; };

describe('instagramDmUrl', () => {
  it('opens a chat with the account whatever form the handle was typed in', () => {
    expect(instagramDmUrl('@studio.a')).toBe('https://ig.me/m/studio.a');
    expect(instagramDmUrl('studio.a')).toBe('https://ig.me/m/studio.a');
    expect(instagramDmUrl('https://www.instagram.com/studio.a/?igsh=x')).toBe('https://ig.me/m/studio.a');
  });
});

describe('InstagramMessageButton', () => {
  it('opens an edit-first dialog: maker highlighted, handle read-only, message and product link prefilled, nothing copied or opened yet', () => {
    const w = stubClipboard(async () => {});
    const d = open();
    expect(d.querySelector('h2 .enquiry-maker')!.textContent).toBe('Studio A');
    const to = d.querySelector('input[name="to"]') as HTMLInputElement;
    expect([to.value, to.readOnly, to.tabIndex]).toEqual(['@studio.a', true, -1]);
    const msg = (screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement).value;
    expect(msg).toBe('Hi Studio A, I saw Vase (₹1,000) on Craftofy and I’m interested.\n\nhttps://craftofy.online/products/vase-p1');
    expect(link().getAttribute('href')).toBe('https://ig.me/m/studio.a');
    expect(link().target).toBe('_blank'); expect(link().rel).toContain('noreferrer');
    expect(w).not.toHaveBeenCalled(); expect(sendEvent).not.toHaveBeenCalled();
  });
  it('copies the buyer’s edited text (not the default) when they press the button, records the contact, and says it was copied', async () => {
    const w = stubClipboard(async () => {});
    open();
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Is it available in blue?' } });
    fireEvent.click(link());
    expect(w).toHaveBeenCalledWith('Is it available in blue?');
    expect(sendEvent).toHaveBeenCalledWith('contact_instagram', 'p1');
    expect(gaContactSeller).toHaveBeenCalledWith({ sellerSlug: 'studio-a-1', method: 'instagram', productId: 'p1' });
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/message copied/i));
  });
  it('when copying is refused or unavailable it selects the text and tells the buyer to copy it', async () => {
    stubClipboard(async () => { throw new Error('denied'); });
    open();
    fireEvent.click(link());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not copy/i));
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    cleanup(); open();
    fireEvent.click(link());
    expect(screen.getByRole('alert').textContent).toMatch(/could not copy/i);
  });
  it('renders nothing for a maker with no Instagram, and Escape closes the dialog', () => {
    const { container } = render(<InstagramMessageButton product={{ ...P, instagram: undefined }} productUrl="https://craftofy.online/products/vase-p1" className="x" />);
    expect(container.innerHTML).toBe('');
    cleanup(); open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

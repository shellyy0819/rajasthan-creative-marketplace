// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EmailMakerButton } from '@/components/EmailMakerButton';
import type { Product } from '@/lib/types';

let session: { user: { name: string; email: string } } | null = null;
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: session }) }));
const sendEvent = vi.fn();
vi.mock('@/lib/track', () => ({ sendEvent: (...a: unknown[]) => sendEvent(...a) }));
const gaContactSeller = vi.fn();
vi.mock('@/lib/ga-events', () => ({ gaContactSeller: (...a: unknown[]) => gaContactSeller(...a) }));
afterEach(() => { session = null; cleanup(); vi.unstubAllGlobals(); sendEvent.mockClear(); gaContactSeller.mockClear(); });

const P: Product = { id: 'p1', name: 'Vase', category: 'Pottery', city: 'Jaipur', cityId: 1, citySlug: 'jaipur', pricePaise: 100000, seller: 'Studio A', description: 'd', stock: 1, status: 'APPROVED', email: 'shop@studio.co', sellerSlug: 'studio-a-1' };
const MSG = 'Hi Studio A, I saw Vase (₹1,000) on Craftofy and I’m interested.';
const open = () => { render(<EmailMakerButton product={P} className="button maker-chip" />); fireEvent.click(screen.getByRole('button', { name: /email/i })); return screen.getByRole('dialog'); };
const fillAnon = () => {
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Asha' } });
  fireEvent.change(screen.getByLabelText(/your email/i), { target: { value: 'asha@buyer.co' } });
};
const signIn = () => { session = { user: { name: 'Asha B', email: 'asha@buyer.co' } }; };

describe('shared', () => {
  it('highlights the maker’s name in the heading', () => {
    const d = open();
    expect(d.querySelector('h2 .enquiry-maker')!.textContent).toBe('Studio A');
    expect(screen.getByRole('heading', { name: 'Email Studio A' })).toBeTruthy();
  });
  it('shows the maker’s address (no name) in a read-only field that is not a tab stop', () => {
    const d = open();
    const to = d.querySelector('input[name="to"]') as HTMLInputElement;
    expect(to.value).toBe('shop@studio.co'); expect(to.readOnly).toBe(true); expect(to.tabIndex).toBe(-1);
    expect(getComputedStyle(to).pointerEvents).not.toBe('none');
  });
  it('Escape closes it', () => {
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('not signed in: the buyer sends it themselves from their own email app', () => {
  it('opens with the default message in the box, empty name and email, and sends nothing', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    open();
    expect((screen.getByLabelText(/^message/i) as HTMLTextAreaElement).value).toBe(MSG);
    const from = screen.getByLabelText(/your email/i) as HTMLInputElement;
    expect(from.value).toBe(''); expect(from.readOnly).toBe(false); expect(from.required).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled(); expect(sendEvent).not.toHaveBeenCalled();
  });
  it('the button does nothing until name, a valid email and a message are given', () => {
    open();
    const go = screen.getByRole('link', { name: /open in my email app/i });
    expect(go.getAttribute('aria-disabled')).toBe('true');
    expect(go.getAttribute('href')).toBeNull();
    fireEvent.click(go);
    expect(sendEvent).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Asha' } });
    fireEvent.change(screen.getByLabelText(/your email/i), { target: { value: 'nope' } });
    expect(screen.getByRole('link', { name: /open in my email app/i }).getAttribute('href')).toBeNull();
  });
  it('builds a mailto to the maker with the message and the buyer’s name and email, records the contact, and closes with no "sent" screen', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    open(); fillAnon();
    const go = screen.getByRole('link', { name: /open in my email app/i });
    const u = new URL(go.getAttribute('href')!);
    expect(u.protocol).toBe('mailto:'); expect(u.pathname).toBe('shop@studio.co');
    expect(u.searchParams.get('subject')).toBe('Enquiry about Vase on Craftofy');
    expect(u.searchParams.get('body')).toContain(MSG);
    expect(u.searchParams.get('body')).toContain('Asha <asha@buyer.co>');
    fireEvent.click(go);
    expect(sendEvent).toHaveBeenCalledWith('contact_email', 'p1');
    expect(gaContactSeller).toHaveBeenCalledWith({ sellerSlug: 'studio-a-1', method: 'email', productId: 'p1' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText(/email sent/i)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('tells the buyer Craftofy cannot see whether it is sent, and that signing in lets Craftofy send it', () => {
    open();
    expect(screen.getByText(/cannot see whether you send it/i)).toBeTruthy();
    expect(screen.getByText(/sign in and craftofy will send it/i)).toBeTruthy();
  });
});

describe('signed in: Craftofy sends it and shows the mail that went out', () => {
  it('prefills name and the read-only account email', () => {
    signIn(); open();
    expect((screen.getByLabelText(/your name/i) as HTMLInputElement).value).toBe('Asha B');
    const from = screen.getByLabelText(/your email/i) as HTMLInputElement;
    expect(from.value).toBe('asha@buyer.co'); expect(from.readOnly).toBe(true);
    expect((screen.getByLabelText(/^message/i) as HTMLTextAreaElement).value).toBe(MSG);
  });
  it('sends name, email and message, then shows the mail to the buyer', async () => {
    signIn();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ seller: 'Studio A', to: 'shop@studio.co', subject: 'Enquiry about Vase on Craftofy', text: 'BODY TEXT' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    open();
    fireEvent.click(screen.getByRole('button', { name: /send email/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: /email sent/i })).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/products/p1/enquiry');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ name: 'Asha B', email: 'asha@buyer.co', message: MSG });
    const d = screen.getByRole('dialog');
    for (const t of ['Studio A <shop@studio.co>', 'Enquiry about Vase on Craftofy', 'BODY TEXT', 'asha@buyer.co']) expect(d.textContent).toContain(t);
    expect(sendEvent).toHaveBeenCalledWith('contact_email', 'p1');
    expect(gaContactSeller).toHaveBeenCalledWith({ sellerSlug: 'studio-a-1', method: 'email', productId: 'p1' });
  });
  it('shows the server’s error and records no contact when the send fails', async () => {
    signIn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Too many emails sent. Please try again later.' }), { status: 429 })));
    open();
    fireEvent.click(screen.getByRole('button', { name: /send email/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Too many emails sent'));
    expect(screen.queryByRole('heading', { name: /email sent/i })).toBeNull();
    expect(sendEvent).not.toHaveBeenCalled();
  });
  it('offers the buyer’s own email app when sending is unavailable', async () => {
    signIn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Email is not available right now.' }), { status: 503 })));
    open();
    fireEvent.click(screen.getByRole('button', { name: /send email/i }));
    await waitFor(() => expect(screen.getByRole('link', { name: /email app/i }).getAttribute('href')).toMatch(/^mailto:shop@studio\.co\?/));
  });
});

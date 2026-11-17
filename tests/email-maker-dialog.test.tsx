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
const open = () => { render(<EmailMakerButton product={P} className="button maker-chip" />); fireEvent.click(screen.getByRole('button', { name: /email/i })); return screen.getByRole('dialog'); };
const fill = () => {
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Asha' } });
  fireEvent.change(screen.getByLabelText(/your email/i), { target: { value: 'asha@buyer.co' } });
};

describe('EmailMakerButton: who it is from', () => {
  it('not signed in: the buyer types their own email as the From address', () => {
    open();
    const from = screen.getByLabelText(/your email/i) as HTMLInputElement;
    expect(from.value).toBe(''); expect(from.readOnly).toBe(false); expect(from.required).toBe(true);
    expect(screen.getByText(/replies will go to this address/i)).toBeTruthy();
  });
  it('signed in: name and email come from the account and the email cannot be changed', () => {
    session = { user: { name: 'Asha B', email: 'asha@buyer.co' } };
    open();
    expect((screen.getByLabelText(/your name/i) as HTMLInputElement).value).toBe('Asha B');
    const from = screen.getByLabelText(/your email/i) as HTMLInputElement;
    expect(from.value).toBe('asha@buyer.co'); expect(from.readOnly).toBe(true);
  });
});

describe('EmailMakerButton', () => {
  it('opens a dialog with the default message already in the box, nothing sent yet', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    open();
    expect((screen.getByLabelText(/message/i) as HTMLTextAreaElement).value).toBe('Hi Studio A, I saw Vase (₹1,000) on Craftofy and I’m interested.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendEvent).not.toHaveBeenCalled();
  });
  it('sends name, email and the message, then shows the buyer the mail that went out', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ seller: 'Studio A', subject: 'Enquiry about Vase on Craftofy', text: 'BODY TEXT' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    open(); fill();
    fireEvent.click(screen.getByRole('button', { name: /send email/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: /email sent/i })).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/products/p1/enquiry');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ name: 'Asha', email: 'asha@buyer.co', message: 'Hi Studio A, I saw Vase (₹1,000) on Craftofy and I’m interested.' });
    const d = screen.getByRole('dialog');
    expect(d.textContent).toContain('Studio A');
    expect(d.textContent).toContain('Enquiry about Vase on Craftofy');
    expect(d.textContent).toContain('BODY TEXT');
    expect(d.textContent).toContain('asha@buyer.co');
    expect(sendEvent).toHaveBeenCalledWith('contact_email', 'p1');
    expect(gaContactSeller).toHaveBeenCalledWith({ sellerSlug: 'studio-a-1', method: 'email', productId: 'p1' });
  });
  it('shows the server’s error and records no contact when the send fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Too many requests.' }), { status: 429 })));
    open(); fill();
    fireEvent.click(screen.getByRole('button', { name: /send email/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Too many requests.'));
    expect(screen.queryByRole('heading', { name: /email sent/i })).toBeNull();
    expect(sendEvent).not.toHaveBeenCalled();
  });
  it('offers the buyer’s own email app when sending is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Email is not available right now.' }), { status: 503 })));
    open(); fill();
    fireEvent.click(screen.getByRole('button', { name: /send email/i }));
    await waitFor(() => expect(screen.getByRole('link', { name: /email app/i }).getAttribute('href')).toMatch(/^mailto:shop@studio\.co\?/));
  });
  it('Escape closes it', () => {
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

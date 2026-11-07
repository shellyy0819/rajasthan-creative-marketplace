// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
import { SellerOnboarding } from '@/components/SellerOnboarding';

const props = { initialName: 'Meera Rao', initialEmail: 'c@x.co', postsUrl: 'https://d.example/p', postsUrlNew: 'https://d.example/p?new=1' };
const craft = {
  brandName: 'Meera Pottery', category: 'Pottery', description: 'Hand-thrown mugs.', city: { ref: 'REF-KOTA', label: 'Kota, Rajasthan', state: 'Rajasthan' },
  instagram: '@meerapottery', website: '', logoUrl: 'https://cdn.example/logos/u1/a.png', contactMethods: ['instagram'], sameAsMobile: true, whatsapp: '',
};
let posts: number;
const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: () => Promise.resolve(body) }) as Response;

beforeEach(() => {
  sessionStorage.clear(); posts = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/categories') return reply(200, ['Pottery', 'Textiles']);
    if (url.startsWith('/api/places')) return reply(200, []);
    if (url === '/api/onboarding') { posts++; return reply(200, { status: 'ok' }); }
    return reply(404, {});
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openStep2(over: Record<string, unknown> = {}) {
  sessionStorage.setItem('craftofy.onboarding', JSON.stringify({ email: 'c@x.co', step: 2, fullName: 'Meera Rao', mobile: '9876543210', craft: { ...craft, ...over } }));
  render(<SellerOnboarding {...props} />);
  await screen.findByText('Step 2 of 2: Your craft');
  await waitFor(() => expect(screen.getByRole('option', { name: 'Textiles' })).toBeTruthy());
}
const finishBtn = () => screen.getByRole('button', { name: 'Finish and add my first product' }) as HTMLButtonElement;
const clickFinish = () => { finishBtn().focus(); fireEvent.click(finishBtn()); };

describe('draft-review notice before submit', () => {
  it('does not open when Step 2 is invalid, and shows the inline errors', async () => {
    await openStep2({ brandName: '' });
    clickFinish();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Enter your brand name.')).toBeTruthy();
    expect(posts).toBe(0);
  });

  it('opens when Step 2 is valid, sends nothing yet, and has the exact copy', async () => {
    await openStep2();
    clickFinish();
    const d = screen.getByRole('dialog');
    expect(d.textContent).toContain('Before you add your products');
    expect(d.textContent).toContain('Every product you add starts as a draft. Once an admin reviews it, it is published automatically.');
    expect(screen.getByRole('button', { name: 'Got it, finish' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeTruthy();
    expect(posts).toBe(0);
  });

  it('has dialog semantics, moves focus in and locks body scroll', async () => {
    await openStep2();
    clickFinish();
    const d = screen.getByRole('dialog');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(d.getAttribute('aria-labelledby')!)!.textContent).toBe('Before you add your products');
    expect(d.contains(document.activeElement)).toBe(true);
    expect(document.body.classList.contains('modal-open')).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('traps Tab inside the dialog', async () => {
    await openStep2();
    clickFinish();
    const ok = screen.getByRole('button', { name: 'Got it, finish' });
    ok.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Go back' }));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(ok);
  });

  it('confirm closes the dialog and sends exactly one POST, even on a double click', async () => {
    await openStep2();
    clickFinish();
    const ok = screen.getByRole('button', { name: 'Got it, finish' });
    act(() => { fireEvent.click(ok); fireEvent.click(ok); }); // one batch: no re-render between the clicks
    expect(screen.queryByRole('dialog')).toBeNull();
    await screen.findByText(/Meera Pottery/);
    expect(posts).toBe(1);
  });

  it('Go back sends nothing and returns focus to Finish', async () => {
    await openStep2();
    clickFinish();
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(finishBtn());
    expect(posts).toBe(0);
  });

  it('Escape sends nothing and returns focus to Finish', async () => {
    await openStep2();
    clickFinish();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(finishBtn());
    expect(posts).toBe(0);
  });

  it('a backdrop click sends nothing and returns focus to Finish', async () => {
    await openStep2();
    clickFinish();
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(finishBtn());
    expect(posts).toBe(0);
  });
});

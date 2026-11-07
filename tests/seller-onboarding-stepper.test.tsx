// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
import { SellerOnboarding } from '@/components/SellerOnboarding';

const props = { initialName: 'Chai Maker', initialEmail: 'c@x.co', postsUrl: '/dashboard/posts', postsUrlNew: '/dashboard/posts?new=1' };

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function steps() { return within(screen.getByRole('list', { name: 'Progress' })).getAllByRole('listitem'); }
function toStep2() {
  fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: '9876543210' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('onboarding stepper', () => {
  it('renders two steps with exact labels', () => {
    render(<SellerOnboarding {...props} />);
    const items = steps();
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('You');
    expect(items[1].textContent).toContain('Your craft');
  });

  it('step 1 is current (aria-current) and not a button; future step is not focusable', () => {
    render(<SellerOnboarding {...props} />);
    const [one, two] = steps();
    expect(one.getAttribute('aria-current')).toBe('step');
    expect(two.getAttribute('aria-current')).toBeNull();
    expect(within(one).queryByRole('button')).toBeNull();
    expect(within(two).queryByRole('button')).toBeNull();
    expect(two.querySelector('[tabindex], a, button, input')).toBeNull();
  });

  it('after Continue step 2 is current and step 1 is a completed button', () => {
    render(<SellerOnboarding {...props} />);
    toStep2();
    const [one, two] = steps();
    expect(two.getAttribute('aria-current')).toBe('step');
    expect(one.getAttribute('aria-current')).toBeNull();
    expect(within(one).getByRole('button').getAttribute('type')).toBe('button');
  });

  it('clicking completed step 1 returns to step 1 with values intact and focuses the heading', () => {
    render(<SellerOnboarding {...props} />);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Asha Rao' } });
    toStep2();
    fireEvent.click(within(steps()[0]).getByRole('button'));
    expect(steps()[0].getAttribute('aria-current')).toBe('step');
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Asha Rao');
    expect((screen.getByLabelText(/Mobile number/) as HTMLInputElement).value).toBe('9876543210');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
    expect(JSON.parse(sessionStorage.getItem('craftofy.onboarding')!).step).toBe(1);
  });

  it('keeps the sr-only position text', () => {
    render(<SellerOnboarding {...props} />);
    const t = screen.getByText('Step 1 of 2: You');
    expect(t.className).toContain('sr-only');
    toStep2();
    expect(screen.getByText('Step 2 of 2: Your craft').className).toContain('sr-only');
  });

  it('shows no stepper on the done screen', async () => {
    const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: () => Promise.resolve(body) }) as Response;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/categories') return reply(200, ['Pottery']);
      if (url.startsWith('/api/places')) return reply(200, []);
      return reply(200, { status: 'ok' });
    }));
    sessionStorage.setItem('craftofy.onboarding', JSON.stringify({ email: 'c@x.co', step: 2, fullName: 'Meera Rao', mobile: '9876543210',
      craft: { brandName: 'Meera Pottery', category: 'Pottery', description: 'Hand-thrown mugs.', city: { ref: 'REF-KOTA', label: 'Kota, Rajasthan', state: 'Rajasthan' }, instagram: '@meerapottery', website: '', logoUrl: 'https://cdn.example/logos/u1/a.png', contactMethods: ['instagram'], sameAsMobile: true, whatsapp: '' } }));
    render(<SellerOnboarding {...props} />);
    await screen.findByText('Step 2 of 2: Your craft');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Pottery' })).toBeTruthy());
    expect(screen.getByRole('list', { name: 'Progress' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Finish and add my first product' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Got it, finish' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Progress' })).toBeNull());
    expect(screen.queryByText(/Step \d of 2/)).toBeNull();
  });

  it('css: a connector is green only after a done step, never after the current one', async () => {
    const css = (await import('node:fs')).readFileSync('src/app/globals.css', 'utf8');
    const greens = [...css.matchAll(/([^{}]*\.onboard-stepper-step[^{}]*::before)\s*\{[^}]*background:\s*var\(--green\)/g)].map(m => m[1]);
    expect(greens.join(' ')).toMatch(/\.done \+ \.onboard-stepper-step::before/);
    expect(greens.join(' ')).not.toMatch(/\.current \+/);
  });
});

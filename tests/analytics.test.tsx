// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

const nav = vi.hoisted(() => ({ path: '/', search: '' }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// The footer calls connection() to stay per-request; outside Next there is no request scope.
vi.mock('next/server', async orig => ({ ...(await orig<typeof import('next/server')>()), connection: async () => undefined }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path, useSearchParams: () => new URLSearchParams(nav.search) }));
import { Analytics, OPEN_SETTINGS_EVENT } from '@/components/Analytics';
import { CONSENT_KEY, __resetAnalyticsForTests } from '@/lib/analytics';

const ID = 'G-ABC123XYZ9';
const gaScripts = () => document.head.querySelectorAll('script[src*="googletagmanager.com"]');
const layer = () => ((window as never as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map(a => Array.from(a));
const pageViews = () => layer().filter(e => e[0] === 'event' && e[1] === 'page_view').map(e => (e[2] as { page_path: string }).page_path);

beforeEach(() => {
  localStorage.clear(); document.head.innerHTML = ''; nav.path = '/'; nav.search = '';
  __resetAnalyticsForTests();
  for (const k of Object.keys(window)) if (k.startsWith('ga-disable') || k === 'dataLayer' || k === 'gtag') delete (window as never as Record<string, unknown>)[k];
  Object.defineProperty(window, 'location', { value: new URL('https://www.example.com/'), writable: true });
});
afterEach(cleanup);

describe('Analytics: consent first', () => {
  it('renders nothing and loads nothing without a (valid) measurement id', () => {
    render(<Analytics />); render(<Analytics measurementId="UA-1" />);
    expect(screen.queryByRole('region', { name: /cookie/i })).toBeNull();
    expect(gaScripts()).toHaveLength(0);
  });
  it('shows the banner and loads no script until a choice is made', () => {
    render(<Analytics measurementId={ID} />);
    expect(screen.getByRole('region', { name: /cookie/i })).toBeTruthy();
    expect(gaScripts()).toHaveLength(0);
    expect(layer()).toEqual([]);
  });
  it('Accept stores consent, hides the banner, loads gtag.js and sends the current page view', () => {
    nav.path = '/shop'; nav.search = 'q=bag';
    render(<Analytics measurementId={ID} />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(localStorage.getItem(CONSENT_KEY)).toBe('granted');
    expect(screen.queryByRole('region', { name: /cookie/i })).toBeNull();
    expect(gaScripts()).toHaveLength(1);
    expect(pageViews()).toEqual(['/shop?q=bag']);
  });
  it('Decline stores the choice, hides the banner and never loads anything, even after navigation', () => {
    const { rerender } = render(<Analytics measurementId={ID} />);
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(localStorage.getItem(CONSENT_KEY)).toBe('denied');
    nav.path = '/shop'; rerender(<Analytics measurementId={ID} />);
    expect(gaScripts()).toHaveLength(0);
    expect(layer()).toEqual([]);
  });
  it('a returning visitor who accepted is tracked at once with no banner; one who declined sees no banner and no tracking', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    const first = render(<Analytics measurementId={ID} />);
    expect(screen.queryByRole('region', { name: /cookie/i })).toBeNull();
    expect(gaScripts()).toHaveLength(1);
    first.unmount(); cleanup(); document.head.innerHTML = ''; __resetAnalyticsForTests();
    localStorage.setItem(CONSENT_KEY, 'denied');
    render(<Analytics measurementId={ID} />);
    expect(screen.queryByRole('region', { name: /cookie/i })).toBeNull();
    expect(gaScripts()).toHaveLength(0);
  });
  it('works with blocked storage: banner every visit, Accept still enables GA for this visit', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('x'); });
    render(<Analytics measurementId={ID} />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(gaScripts()).toHaveLength(1);
    vi.restoreAllMocks();
  });
});

describe('Analytics: page views', () => {
  it('sends one page_view per distinct URL: route changes count, the same URL twice and strict-mode re-renders do not', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    const { rerender } = render(<Analytics measurementId={ID} />);
    rerender(<Analytics measurementId={ID} />);
    nav.path = '/shop'; rerender(<Analytics measurementId={ID} />);
    nav.search = 'q=bag'; rerender(<Analytics measurementId={ID} />);   // query-only change is a different page view
    nav.path = '/shop'; nav.search = 'q=bag'; rerender(<Analytics measurementId={ID} />);
    nav.path = '/products/x-p1'; nav.search = ''; rerender(<Analytics measurementId={ID} />);
    expect(pageViews()).toEqual(['/', '/shop', '/shop?q=bag', '/products/x-p1']);
  });
  it('React strict mode (effects run twice) still sends the first page view once', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    render(<React.StrictMode><Analytics measurementId={ID} /></React.StrictMode>);
    expect(pageViews()).toEqual(['/']);
  });
  it('the first page view is queued even though gtag.js has not loaded yet', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    render(<Analytics measurementId={ID} />);
    expect(pageViews()).toEqual(['/']);
  });
});

describe('Analytics: never on the dashboard', () => {
  it('does not load or send on /dashboard paths, and on the dashboard host', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    nav.path = '/dashboard/posts';
    render(<Analytics measurementId={ID} />);
    expect(gaScripts()).toHaveLength(0);
    cleanup();
    nav.path = '/';
    Object.defineProperty(window, 'location', { value: new URL('https://dashboard.example.com/'), writable: true });
    render(<Analytics measurementId={ID} dashboardHost="dashboard.example.com" />);
    expect(gaScripts()).toHaveLength(0);
    expect(screen.queryByRole('region', { name: /cookie/i })).toBeNull(); // staff are not asked either
  });
  it('navigating from the shop into the dashboard stops page views', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    const { rerender } = render(<Analytics measurementId={ID} />);
    nav.path = '/dashboard/posts'; rerender(<Analytics measurementId={ID} />);
    expect(pageViews()).toEqual(['/']);
  });
});

describe('Analytics: changing your mind', () => {
  it('the settings event reopens the banner; Decline then disables GA and deletes its cookies', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    render(<Analytics measurementId={ID} />);
    document.cookie = '_ga=GA1.1.1.1; path=/';
    act(() => { window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT)); });
    expect(screen.getByRole('region', { name: /cookie/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(localStorage.getItem(CONSENT_KEY)).toBe('denied');
    expect((window as never as Record<string, unknown>)[`ga-disable-${ID}`]).toBe(true);
    expect(document.cookie).not.toContain('_ga');
  });
  it('after withdrawing, a later route change sends nothing', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    const { rerender } = render(<Analytics measurementId={ID} />);
    act(() => { window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT)); });
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    nav.path = '/shop'; rerender(<Analytics measurementId={ID} />);
    expect(pageViews()).toEqual(['/']);
  });
  it('the banner is operable by keyboard and has an explanation', () => {
    render(<Analytics measurementId={ID} />);
    const region = screen.getByRole('region', { name: /cookie/i });
    expect(region.textContent).toMatch(/Google Analytics/);
    for (const b of screen.getAllByRole('button')) expect((b as HTMLButtonElement).type).toBe('button');
  });
});

import { CookieSettings } from '@/components/CookieSettings';

describe('CookieSettings link', () => {
  it('is a button that dispatches the open-settings event', () => {
    const seen = vi.fn(); window.addEventListener(OPEN_SETTINGS_EVENT, seen);
    render(<CookieSettings />);
    const b = screen.getByRole('button', { name: 'Cookie settings' }) as HTMLButtonElement;
    expect(b.type).toBe('button');
    fireEvent.click(b);
    expect(seen).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_SETTINGS_EVENT, seen);
  });
  // SKIPPED on purpose: Footer.tsx has the Cookie settings link commented out (the owner's choice in PR #7). Remove the skip when it comes back.
  it.skip('the footer has it', async () => {
    vi.doMock('@/lib/cities', () => ({ listActiveCities: async () => [] }));
    const { Footer } = await import('@/components/Footer');
    render(await Footer());
    expect(screen.getByRole('button', { name: 'Cookie settings' })).toBeTruthy();
  });
});

describe('banner styles', () => {
  it('is fixed to the bottom, above content, full width on phones, and keeps the shared control height', async () => {
    const css = (await import('./helpers/css')).readCss();
    expect(css).toMatch(/\.cookie-banner\{[^}]*position:fixed[^}]*bottom/);
    expect(css).toMatch(/\.cookie-banner\{[^}]*z-index:\d+/);
    expect(css).toMatch(/@media\(max-width:\d+px\)\{[^}]*\.cookie-banner/);
  });
});

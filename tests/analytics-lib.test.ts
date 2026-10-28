// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CONSENT_KEY, __resetAnalyticsForTests, disableGa, gaEvent, loadGa, pageView, readConsent, shouldTrack, validMeasurementId, writeConsent } from '@/lib/analytics';

beforeEach(() => {
  __resetAnalyticsForTests();
  localStorage.clear();
  document.head.innerHTML = '';
  document.cookie.split(';').forEach(c => { document.cookie = c.split('=')[0].trim() + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; });
  for (const k of Object.keys(window)) if (k.startsWith('ga-disable') || k === 'dataLayer' || k === 'gtag') delete (window as never as Record<string, unknown>)[k];
});

describe('consent storage', () => {
  it('round-trips granted/denied and returns null for nothing or junk', () => {
    expect(readConsent()).toBeNull();
    writeConsent('granted'); expect(readConsent()).toBe('granted');
    writeConsent('denied'); expect(readConsent()).toBe('denied');
    localStorage.setItem(CONSENT_KEY, 'maybe'); expect(readConsent()).toBeNull();
  });
  it('never throws when storage is blocked (private mode)', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readConsent()).toBeNull();
    expect(() => writeConsent('granted')).not.toThrow();
    get.mockRestore(); set.mockRestore();
  });
});

describe('validMeasurementId', () => {
  it('accepts G- ids only', () => {
    for (const ok of ['G-ABC123XYZ9', 'G-1234567890', 'G-ABCDEF']) expect(validMeasurementId(ok)).toBe(true);
    for (const bad of ['', 'UA-123456-1', 'g-abc123xyz9', 'G-ab', "G-1');alert(1)//", 'G-ABC 123', undefined, null, 5, 'G-ABCDEFGHIJKLM1'])
      expect(validMeasurementId(bad)).toBe(false);
  });
});

describe('shouldTrack', () => {
  it('tracks shop pages and nothing on the dashboard host or dashboard paths', () => {
    expect(shouldTrack('www.example.com', '/shop', 'dashboard.example.com')).toBe(true);
    expect(shouldTrack('www.example.com', '/', undefined)).toBe(true);
    expect(shouldTrack('dashboard.example.com', '/', 'dashboard.example.com')).toBe(false); // "/" is the dashboard there
    expect(shouldTrack('DASHBOARD.example.com:443', '/shop', 'dashboard.example.com')).toBe(false);
    for (const p of ['/dashboard', '/dashboard/posts', '/admin', '/admin/users']) expect(shouldTrack('www.example.com', p)).toBe(false);
  });
  it('look-alike paths are tracked', () => {
    expect(shouldTrack('www.example.com', '/dashboards-of-india')).toBe(true);
    expect(shouldTrack('www.example.com', '/administrators')).toBe(true);
  });
});

describe('loadGa / pageView / gaEvent / disableGa', () => {
  it('loadGa injects gtag.js exactly once and queues js + config (send_page_view false)', () => {
    loadGa('G-ABC123XYZ9'); loadGa('G-ABC123XYZ9');
    const scripts = document.head.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]');
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toContain('id=G-ABC123XYZ9');
    expect((scripts[0] as HTMLScriptElement).async).toBe(true);
    const queued = (window as never as { dataLayer: unknown[][] }).dataLayer.map(a => Array.from(a as ArrayLike<unknown>));
    expect(queued[0][0]).toBe('js');
    expect(queued[1]).toEqual(['config', 'G-ABC123XYZ9', { send_page_view: false }]);
  });
  it('loadGa refuses an invalid id and injects nothing', () => {
    loadGa("G-1');alert(1)//");
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });
  it('pageView queues a page_view with path and location even before the script has loaded', () => {
    loadGa('G-ABC123XYZ9');
    pageView('G-ABC123XYZ9', '/shop?q=bag');
    const last = Array.from((window as never as { dataLayer: ArrayLike<unknown>[] }).dataLayer.at(-1)!);
    expect(last[0]).toBe('event'); expect(last[1]).toBe('page_view');
    expect(last[2]).toMatchObject({ page_path: '/shop?q=bag', send_to: 'G-ABC123XYZ9' });
  });
  it('gaEvent is a silent no-op until GA has been loaded; afterwards it queues the event', () => {
    expect(() => gaEvent('like', { item_id: 'p1' })).not.toThrow();
    expect((window as never as { dataLayer?: unknown[] }).dataLayer).toBeUndefined();
    loadGa('G-ABC123XYZ9');
    gaEvent('like', { item_id: 'p1' });
    const last = Array.from((window as never as { dataLayer: ArrayLike<unknown>[] }).dataLayer.at(-1)!);
    expect(last.slice(0, 3)).toEqual(['event', 'like', { item_id: 'p1' }]);
  });
  it('disableGa sets the ga-disable flag, deletes _ga cookies, and stops gaEvent', () => {
    loadGa('G-ABC123XYZ9');
    document.cookie = '_ga=GA1.1.1.1; path=/'; document.cookie = '_ga_ABC123XYZ9=GS1.1.1; path=/'; document.cookie = 'keep=1; path=/';
    disableGa('G-ABC123XYZ9');
    expect((window as never as Record<string, unknown>)['ga-disable-G-ABC123XYZ9']).toBe(true);
    expect(document.cookie).toContain('keep=1');
    expect(document.cookie).not.toContain('_ga');
    const before = (window as never as { dataLayer: unknown[] }).dataLayer.length;
    gaEvent('like', { item_id: 'p1' });
    expect((window as never as { dataLayer: unknown[] }).dataLayer.length).toBe(before);
  });
});

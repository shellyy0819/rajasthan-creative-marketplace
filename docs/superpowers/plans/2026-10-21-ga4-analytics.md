# GA4 Analytics with Cookie Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track page views and unique visitors of the public shop in Google Analytics 4, loaded only after the visitor accepts a cookie banner, and never on the dashboard.

**Architecture:** One client component `Analytics` (mounted in the root layout) owns consent, loads `gtag.js` by injecting a `<script>` only after consent, and sends a `page_view` on every client-side route change. Pure helpers in `src/lib/analytics.ts` (consent storage, "should we track this host/path", `gaEvent`) hold all logic so it is unit-testable. The measurement id is a runtime env var read on the server and passed as a prop (no build-time `NEXT_PUBLIC_` inlining, so a Docker image can be re-configured without a rebuild).

**Tech Stack:** Next.js 16 App Router, React 19, Vitest + Testing Library (jsdom). No new dependencies.

**Spec:** No spec doc. Requirements = user message: "add GA4 for tracking unique views of users". Decisions made with the user: **load GA4 only after the visitor accepts a small cookie banner**; declined visitors are not tracked. Companion plan (uses `gaEvent` from this one): `docs/superpowers/plans/2026-10-21-trending-products.md`.

## Environment facts

- Node 22: `export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH`. Run the full suite as `npx vitest run --maxWorkers=2 --testTimeout=60000 --hookTimeout=60000` (the machine is often loaded).
- The user is editing the same working tree (Craftofy rebrand: `Header.tsx`, `Hero.tsx`, `Footer.tsx`, `site.ts`, `globals.css`, …). **Stage only the files you create or change, by name** (never `git add -A`), and never commit `.env*` or `*.pem` files. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not push.
- `Footer.tsx` and `globals.css` carry uncommitted user edits: make your edit, but commit only your hunks (`git add -p` is not available here; instead commit those two files only if `git diff <file>` shows nothing but your change, otherwise leave them unstaged and say so in your final message).
- `.env.example` no longer exists; document settings in `.env.backend.example` and the README.
- The dashboard may live on its own host (`DASHBOARD_URL`, see `src/lib/hosts.ts` and `docs/subdomains.md`); its pages are under `/dashboard`.

## Global Constraints

- GA4 loads **only** after the visitor clicked Accept. Before that, and after Decline, no request to `googletagmanager.com` / `google-analytics.com` is made and no `_ga*` cookie is set.
- The measurement id comes from the env var `GA_MEASUREMENT_ID` (format `G-XXXXXXXXXX`). Missing or malformed → the component renders nothing and loads nothing.
- Never track the dashboard: not on the dashboard host (`hostConfig().dashboardHost`), not under `/dashboard` or `/admin`.
- Consent is stored in `localStorage` under the key `rr_consent` with the values `granted` or `denied`; storage failures (private mode, blocked) must not throw and must behave as "no choice yet" (banner shown every visit).
- Withdrawing consent (footer link "Cookie settings" → Decline) disables GA immediately (`window['ga-disable-<ID>'] = true`) and deletes the `_ga` / `_ga_<ID>` cookies.
- Page views are sent explicitly (`send_page_view: false` in `config`) on first load **and** on every client-side navigation, with `page_path` including the query string, once per distinct URL.
- No personal data is added to events (no emails, names, ids from our database).
- Banner follows the design skill (`.claude/skills/rang-rajasthan-design/SKILL.md`): shared tokens, 36px controls, visible focus, works at 400px width, `role="region"` with a label, buttons not links.

## Review Focus

1. **Consent leaks:** GA scripts or cookies appearing before Accept, after Decline, or after withdrawal; a returning visitor who declined being tracked after a route change. (Task 2 tests)
2. **Dashboard tracking:** staff screens (`/dashboard/...`, and `/` on the dashboard host, which is a rewrite of `/dashboard`) must never load GA. (Task 1 `shouldTrack` tests, Task 2 component tests)
3. **Duplicate or missing page views:** React strict-mode double effects, the same URL sent twice, query-string-only navigation not counted, first page view lost because the script was still loading (events must queue until `gtag` exists). (Task 2)
4. **Broken storage / odd env:** `localStorage` throwing, malformed measurement id (`UA-123`, empty string, injected quotes like `G-1');alert(1)//`) must not run or inject anything. (Task 1)
5. **Banner usability:** keyboard operation, not covering the sign-in or add-to-bag buttons at phone width, reopen via the footer link. (Task 3)

---

## File Structure

```
src/lib/analytics.ts            # consent storage, id validation, shouldTrack, gaEvent, loadGa/disableGa (client-safe, no React)
src/components/Analytics.tsx    # consent state + banner + route-change page_view + script loading
src/components/CookieSettings.tsx  # footer button that reopens the banner
src/app/layout.tsx              # mounts <Analytics measurementId dashboardHost />
src/components/Footer.tsx       # + <CookieSettings />
src/app/globals.css             # .cookie-banner styles
.env.backend.example, README.md, docs/analytics.md
tests/analytics-lib.test.ts, tests/analytics.test.tsx
```

---

### Task 1: Analytics helpers (`src/lib/analytics.ts`)

**Files:**
- Create: `src/lib/analytics.ts`, `tests/analytics-lib.test.ts`

**Interfaces:**
- Produces:
  - `type Consent = 'granted' | 'denied'`
  - `CONSENT_KEY = 'rr_consent'`
  - `readConsent(): Consent | null`, `writeConsent(c: Consent): void` (never throw)
  - `validMeasurementId(id: unknown): id is string` (`/^G-[A-Z0-9]{6,12}$/`)
  - `shouldTrack(host: string, path: string, dashboardHost?: string): boolean`
  - `loadGa(id: string): void` (idempotent: injects `gtag.js` once, defines `window.dataLayer` / `window.gtag`, calls `gtag('js', new Date())` and `gtag('config', id, { send_page_view: false })`)
  - `pageView(id: string, path: string): void` (queues through `gtag`, which is defined before the script loads, so early events are not lost)
  - `gaEvent(name: string, params?: Record<string, string | number | boolean>): void` (no-op unless GA is loaded and consent granted)
  - `disableGa(id: string): void` (sets `window['ga-disable-<id>']`, deletes the `_ga`, `_ga_<suffix>` and `_gid` cookies; the already-loaded script stays but is switched off)
  - `__resetAnalyticsForTests(): void` (tests only: forgets that GA was loaded in this module instance; call it in every `beforeEach`)

- [ ] **Step 1: Write the failing tests** `tests/analytics-lib.test.ts` (use `// @vitest-environment jsdom`):

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CONSENT_KEY, disableGa, gaEvent, loadGa, pageView, readConsent, shouldTrack, validMeasurementId, writeConsent } from '@/lib/analytics';

beforeEach(() => {
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
```

- [ ] **Step 2: Run to verify RED** — `npx vitest run tests/analytics-lib.test.ts` → FAIL (`@/lib/analytics` missing).

- [ ] **Step 3: Implement `src/lib/analytics.ts`:**

```ts
import { normalizeHost } from './hosts';

export type Consent = 'granted' | 'denied';
export const CONSENT_KEY = 'rr_consent';

export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch { return null; }
}
export function writeConsent(c: Consent): void {
  try { localStorage.setItem(CONSENT_KEY, c); } catch { /* storage blocked: the banner will simply show again next visit */ }
}

export const validMeasurementId = (id: unknown): id is string => typeof id === 'string' && /^G-[A-Z0-9]{6,12}$/.test(id);

/** False on the dashboard host and under /dashboard or /admin (staff screens are never tracked). */
export function shouldTrack(host: string, path: string, dashboardHost?: string): boolean {
  if (dashboardHost && normalizeHost(host) === dashboardHost) return false;
  const under = (base: string) => path === base || path.startsWith(base + '/');
  return !(under('/dashboard') || under('/admin'));
}

type GaWindow = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; [k: string]: unknown };
const w = () => window as GaWindow;
let loadedId: string | null = null;

export function loadGa(id: string): void {
  if (!validMeasurementId(id) || loadedId) return;
  loadedId = id;
  const win = w();
  win.dataLayer = win.dataLayer ?? [];
  // gtag must push the `arguments` object itself (an Array would be ignored by gtag.js)
  win.gtag = function () { (win.dataLayer as unknown[]).push(arguments); };
  win.gtag('js', new Date());
  win.gtag('config', id, { send_page_view: false });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

export function pageView(id: string, path: string): void {
  if (!loadedId || w()[`ga-disable-${id}`]) return;
  w().gtag?.('event', 'page_view', { page_path: path, page_location: window.location.origin + path, page_title: document.title, send_to: id });
}

export function gaEvent(name: string, params: Record<string, string | number | boolean> = {}): void {
  if (!loadedId || w()[`ga-disable-${loadedId}`]) return;
  w().gtag?.('event', name, params);
}

export function disableGa(id: string): void {
  w()[`ga-disable-${id}`] = true;
  const suffix = id.replace(/^G-/, '');
  const hosts = ['', `; domain=${location.hostname}`, `; domain=.${location.hostname.split('.').slice(-2).join('.')}`];
  for (const name of ['_ga', `_ga_${suffix}`, '_gid'])
    for (const d of hosts) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
}

/** Test helper: forget that GA was loaded in this module instance. */
export const __resetAnalyticsForTests = () => { loadedId = null; };
```
(Update the test's `beforeEach` to also call `__resetAnalyticsForTests()` and import it.)

- [ ] **Step 4: Run to verify GREEN** — `npx vitest run tests/analytics-lib.test.ts` → 12 PASS; `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next/"` clean.
  Mutation check (revert after): make `shouldTrack` always return `true` → the dashboard tests FAIL; remove the `ga-disable` check in `gaEvent` → the disable test FAILS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/analytics.ts tests/analytics-lib.test.ts
git commit -m "feat: GA4 helpers (consent storage, id validation, dashboard exclusion, gtag loader)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `Analytics` component (consent, loading, page views)

**Files:**
- Create: `src/components/Analytics.tsx`, `tests/analytics.test.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: Task 1 (`readConsent`, `writeConsent`, `validMeasurementId`, `shouldTrack`, `loadGa`, `pageView`, `disableGa`).
- Produces: `<Analytics measurementId?: string dashboardHost?: string />`; custom DOM event `rr:open-cookie-settings` (dispatched by the footer link, handled here); exported const `OPEN_SETTINGS_EVENT = 'rr:open-cookie-settings'`.

- [ ] **Step 1: Write the failing tests** `tests/analytics.test.tsx` (jsdom). Mock `next/navigation`:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

const nav = vi.hoisted(() => ({ path: '/', search: '' }));
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
```

- [ ] **Step 2: Run to verify RED** — `npx vitest run tests/analytics.test.tsx` → FAIL (component missing).

- [ ] **Step 3: Implement `src/components/Analytics.tsx`:**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { disableGa, loadGa, pageView, readConsent, shouldTrack, validMeasurementId, writeConsent, type Consent } from '@/lib/analytics';

export const OPEN_SETTINGS_EVENT = 'rr:open-cookie-settings';

/** Cookie banner + Google Analytics 4. Nothing is loaded before the visitor accepts; the dashboard is never tracked. */
export function Analytics({ measurementId, dashboardHost }: { measurementId?: string; dashboardHost?: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [consent, setConsent] = useState<Consent | null | 'unknown'>('unknown'); // 'unknown' until localStorage is read (avoids a banner flash)
  const [asking, setAsking] = useState(false);
  const lastSent = useRef<string | null>(null);
  const enabled = validMeasurementId(measurementId);
  const path = search ? `${pathname}?${search}` : pathname;
  const tracked = typeof window !== 'undefined' && shouldTrack(window.location.host, pathname, dashboardHost);

  useEffect(() => { if (enabled) { const c = readConsent(); setConsent(c); setAsking(c === null); } }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    const open = () => setAsking(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, [enabled]);

  // Load GA once consent is granted, then send one page_view per distinct URL.
  useEffect(() => {
    if (!enabled || consent !== 'granted' || !tracked) return;
    loadGa(measurementId!);
    if (lastSent.current === path) return;
    lastSent.current = path;
    pageView(measurementId!, path);
  }, [enabled, consent, tracked, path, measurementId]);

  if (!enabled || !tracked || !asking) return null;
  const choose = (c: Consent) => {
    writeConsent(c);
    setConsent(c);
    setAsking(false);
    if (c === 'denied') disableGa(measurementId!);
  };
  return (
    <div className="cookie-banner" role="region" aria-label="Cookie consent">
      <p>We use Google Analytics cookies to count visitors and see which pages are useful. Nothing is tracked unless you accept.</p>
      <div className="cookie-actions">
        <button type="button" className="button outline" onClick={() => choose('denied')}>Decline</button>
        <button type="button" className="button primary" onClick={() => choose('granted')}>Accept</button>
      </div>
    </div>
  );
}
```
Mount in `src/app/layout.tsx` (keep the user's other edits): add `import { Suspense } from 'react'; import { Analytics } from '@/components/Analytics'; import { hostConfig } from '@/lib/hosts';` and, after `</main>` inside the providers:
```tsx
<Suspense fallback={null}><Analytics measurementId={process.env.GA_MEASUREMENT_ID} dashboardHost={hostConfig().dashboardHost} /></Suspense>
```
(`Suspense` is required because `useSearchParams` opts out of static rendering; the layout is otherwise unchanged.)

- [ ] **Step 4: Run to verify GREEN** — `npx vitest run tests/analytics.test.tsx tests/analytics-lib.test.ts`; then the whole suite and `npx tsc --noEmit`. Mutation checks (revert after): delete the `consent !== 'granted'` guard → the "no script before choice" tests FAIL; delete the `lastSent` check → the page-view count test FAILS; delete `disableGa` in `choose` → the withdrawal test FAILS.

- [ ] **Step 5: Commit**
```bash
git add src/components/Analytics.tsx src/app/layout.tsx tests/analytics.test.tsx
git commit -m "feat: GA4 loads only after consent, page views per distinct URL, never on the dashboard

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(If `layout.tsx` also contains uncommitted user edits, stage only if `git diff src/app/layout.tsx` is just your Analytics lines; otherwise leave it unstaged and tell the user which 3 lines to keep.)

---

### Task 3: Banner styling, "Cookie settings" link, docs, live check

**Files:**
- Create: `src/components/CookieSettings.tsx`, `docs/analytics.md`
- Modify: `src/components/Footer.tsx`, `src/app/globals.css`, `.env.backend.example`, `README.md`
- Test: extend `tests/analytics.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`OPEN_SETTINGS_EVENT`).
- Produces: `<CookieSettings />` (a `type="button"` styled as a text link).

- [ ] **Step 1: Write the failing tests** (append to `tests/analytics.test.tsx`):

```tsx
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
  it('the footer has it', async () => {
    vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
    const { Footer } = await import('@/components/Footer');
    render(<Footer />);
    expect(screen.getByRole('button', { name: 'Cookie settings' })).toBeTruthy();
  });
});

describe('banner styles', () => {
  it('is fixed to the bottom, above content, full width on phones, and keeps the shared control height', async () => {
    const css = (await import('node:fs')).readFileSync('src/app/globals.css', 'utf8');
    expect(css).toMatch(/\.cookie-banner\{[^}]*position:fixed[^}]*bottom/);
    expect(css).toMatch(/\.cookie-banner\{[^}]*z-index:\d+/);
    expect(css).toMatch(/@media\(max-width:\d+px\)\{[^}]*\.cookie-banner/);
  });
});
```

- [ ] **Step 2: Run to verify RED.**

- [ ] **Step 3: Implement.**
`src/components/CookieSettings.tsx`:
```tsx
'use client';
import { OPEN_SETTINGS_EVENT } from './Analytics';

/** Footer link: lets visitors change their mind about analytics cookies. */
export function CookieSettings() {
  return <button type="button" className="text-link cookie-settings" onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}>Cookie settings</button>;
}
```
`Footer.tsx`: `import { CookieSettings } from './CookieSettings';` and add `<CookieSettings />` next to the "Made with care" span (keep the user's other edits).
Append to `globals.css`:
```css
.cookie-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:65;max-width:720px;margin:0 auto;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:var(--white);border:1px solid var(--control-border);border-radius:6px;padding:14px 18px;box-shadow:0 10px 30px #252a2433;font:500 12px var(--font-sans),sans-serif;line-height:1.6}
.cookie-banner p{margin:0;flex:1 1 280px}.cookie-actions{display:flex;gap:10px}
.cookie-settings{border:0;background:transparent;padding:0;cursor:pointer;font:inherit}
@media(max-width:600px){.cookie-banner{left:8px;right:8px;bottom:8px}.cookie-actions{width:100%}.cookie-actions .button{flex:1}}
```
Docs `docs/analytics.md`: how to create the GA4 property (analytics.google.com → Admin → Create property → Web data stream with the site URL → copy the **Measurement ID** `G-…`), set `GA_MEASUREMENT_ID=G-…` in `.env.local` / `.env.backend` (runtime variable: restart or `docker compose up -d`, no rebuild), how to verify (open the site, accept the banner, Realtime report shows you within a minute; DebugView), and **what "unique views" means in GA4**: GA4 has no "unique pageviews" metric; use **Views** (all page views) and **Users / Active users** (unique visitors) per page in Reports → Engagement → Pages and screens; custom events (`like`, `contact_click`, …) appear under Events after 24 h. Explain that visitors who decline or block cookies are not counted, that the dashboard is never tracked, and that GA4's IP anonymisation is on by default. Add the two lines to `.env.backend.example`:
```
# Google Analytics 4 measurement id (G-XXXXXXXXXX). Empty = analytics and the cookie banner are off.
GA_MEASUREMENT_ID=
```
README: add a short "Analytics (GA4)" section linking to `docs/analytics.md`.

- [ ] **Step 4: Run to verify GREEN**, then the whole suite + `npx tsc --noEmit`.

- [ ] **Step 5: Live check** (local dev server on 3001 or a scratch `next start -p 3217`; never touch the user's running dev server's files):
  1. With `GA_MEASUREMENT_ID` unset: `curl -s localhost:3217/ | grep -c cookie-banner` → `0` (nothing rendered, nothing loaded).
  2. With `GA_MEASUREMENT_ID=G-TEST123456`: the HTML contains no `googletagmanager` (the script is only injected client-side after Accept); check with `curl -s ... | grep -c googletagmanager` → `0`.
  3. If a browser is available (Chrome via `puppeteer-core` in the scratchpad): load `/`, assert the banner appears, no request to `googletagmanager.com` before clicking Accept, a request to `https://www.googletagmanager.com/gtag/js?id=G-TEST123456` after Accept, no banner on reload, then click "Cookie settings" → Decline and assert `_ga` cookies are gone. Visit `/dashboard/posts` with a forged admin cookie and assert no banner and no GA request.
  4. Record any deviation in the final message. Do not put a real measurement id in git.

- [ ] **Step 6: Commit**
```bash
git add src/components/CookieSettings.tsx docs/analytics.md .env.backend.example tests/analytics.test.tsx
# Footer.tsx, globals.css and README.md: stage only if git diff shows nothing but your change
git commit -m "feat: cookie settings link, banner styles and GA4 docs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** GA4 tracking of unique views → Tasks 1–2 (page views per distinct URL) + Task 3 docs on reading unique users per page; consent-first loading → Task 2; dashboard excluded → Tasks 1–2; consent withdrawal → Tasks 1–3; runtime env var → Task 2 layout + Task 3 docs.

**Placeholder scan:** no TBD/TODO. The live-check step names the exact commands and expected values; the measurement id `G-TEST123456` is a throwaway test id used only in that check.

**Type consistency:** `Consent`, `CONSENT_KEY`, `readConsent`/`writeConsent`, `validMeasurementId`, `shouldTrack(host, path, dashboardHost?)`, `loadGa`, `pageView(id, path)`, `gaEvent`, `disableGa`, `OPEN_SETTINGS_EVENT` are named identically in Tasks 1–3 and in the companion trending plan (which only imports `gaEvent`).

**Review Focus coverage:** (1) Task 2 consent tests + Task 3 live check; (2) Task 1 `shouldTrack` + Task 2 dashboard tests; (3) Task 2 page-view tests (dedupe, queueing); (4) Task 1 id and storage tests; (5) Task 2 keyboard test + Task 3 styles/link tests.

**Known limits / decisions to confirm:** (a) visitors who decline are invisible to GA4 (by design); first-party counting for trending is separate (see the trending plan); (b) GA4 reports **Users** rather than a literal "unique views" number; (c) the banner is English only; (d) consent is per browser (localStorage), not per account; (e) the user's uncommitted edits in `Footer.tsx`, `globals.css`, `layout.tsx` and `README.md` may force those files to stay unstaged, in which case the user commits them with their own changes.

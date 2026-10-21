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
const w = () => window as unknown as GaWindow;
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

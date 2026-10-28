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

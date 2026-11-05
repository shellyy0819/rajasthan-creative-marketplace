'use client';
import { useEffect } from 'react';

import { SPLASH_KEY } from '@/lib/init-scripts';

/**
 * Brand splash for phones, shown once per browser session while the first page loads.
 * It fades out on its own via CSS (.splash), so a visitor without JavaScript is never stuck behind it.
 */
export function SplashScreen() {
  useEffect(() => {
    try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch { /* storage blocked: the splash may show again, which is harmless */ }
  }, []);
  return (
    <div className="splash" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="splash-light" src="/splash/screen-color-1080x1920.png" alt="" width={1080} height={1920} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="splash-dark" src="/splash/screen-dark-1080x1920.png" alt="" width={1080} height={1920} />
    </div>
  );
}

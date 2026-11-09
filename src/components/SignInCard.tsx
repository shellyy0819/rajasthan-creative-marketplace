'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';

const COMBINED = 'We could not sign you in with this account. It may be deactivated, or its Google email may not be verified. Contact Craftofy if you think this is a mistake.';
const GENERIC = 'We could not sign you in. Check your connection and try again.';

/** Never show a raw error code: map it to a sentence. */
export function signInErrorMessage(error: string | undefined): string | null {
  if (!error) return null;
  return error === 'AccessDenied' ? COMBINED : GENERIC;
}

function GoogleMark() {
  return (
    <span className="signin-g" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18" focusable="false">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
      </svg>
    </span>
  );
}

export function SignInCard({ callbackUrl, error }: { callbackUrl: string; error?: string }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false); // blocks a second tap before React re-renders
  useEffect(() => {
    // Coming back with the browser's back button must not leave the button stuck.
    const reset = (e: PageTransitionEvent) => { if (e.persisted) { busy.current = false; setPending(false); } };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  const message = failed ? GENERIC : signInErrorMessage(error);
  const label = pending ? 'Taking you to Google…' : error === 'AccessDenied' && !failed ? 'Use a different Google account' : message ? 'Try again with Google' : 'Continue with Google';

  const start = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFailed(false);
    try {
      if (message) await signIn('google', { callbackUrl }, { prompt: 'select_account' });
      else await signIn('google', { callbackUrl });
    } catch {
      busy.current = false;
      setPending(false);
      setFailed(true);
    }
  };

  return (
    <section className="onboard-wrap">
      <div className="onboard-card signin-card">
        <span className="eyebrow">FOR MAKERS</span>
        <h1>Sign in to Craftofy</h1>
        {message ? (
          <div className="signin-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 4.5v4M8 10.8v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            <span>{message}</span>
          </div>
        ) : (
          <p className="onboard-lead">Use your Google account to add products and manage your listings. New here? Signing in sets up your seller profile in about three minutes.</p>
        )}
        <button type="button" className="button primary onboard-cta signin-btn" onClick={start} disabled={pending} aria-busy={pending}>
          {!pending && <GoogleMark />}
          {label}
        </button>
        <p className="onboard-fine">We use Google only to confirm your name and email. We never post anything.</p>
        <Link className="text-link signin-back" href="/">Back to the shop</Link>
      </div>
    </section>
  );
}

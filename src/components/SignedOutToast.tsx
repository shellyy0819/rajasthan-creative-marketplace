'use client';
import { useCallback, useEffect, useState } from 'react';
import { Toast, type ToastState } from '@/components/Toast';

export const SIGNED_OUT_MS = 5000;

/** After sign-out the home page shows a short confirmation. Reads the URL in an effect so the page itself stays static. */
export function SignedOutToast() {
  const [toast, setToast] = useState<ToastState>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('signedout') !== '1') return;
    setToast({ id: Date.now(), kind: 'success', text: 'You have signed out. See you soon.' });
    url.searchParams.delete('signedout');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);
  const close = useCallback(() => setToast(null), []);
  return <Toast toast={toast} onClose={close} ms={SIGNED_OUT_MS} />;
}

'use client';
import { useEffect } from 'react';

export type ToastState = { id: number; kind: 'success' | 'error'; text: string } | null;
export const TOAST_MS = 3000;

/** Green (success) or red (error) message that closes itself after 3 seconds. A new `id` restarts the timer. */
export function Toast({ toast, onClose, ms = TOAST_MS }: { toast: ToastState; onClose: () => void; ms?: number }) {
  const id = toast?.id;
  useEffect(() => {
    if (id === undefined) return;
    const t = setTimeout(onClose, ms);
    return () => clearTimeout(t);
  }, [id, onClose, ms]);
  if (!toast) return null;
  return (
    <div className="rr-toast-wrap">
      <div className={`rr-toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} key={toast.id}>
        <span>{toast.text}</span>
        <button type="button" aria-label="Dismiss message" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

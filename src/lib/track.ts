export type TrackType = 'view' | 'contact' | 'artist';

/** Fire-and-forget first-party engagement event. Never throws and never delays navigation. */
export function sendEvent(type: TrackType, productId: string): void {
  try {
    const body = JSON.stringify({ type, productId });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }))) return;
    void fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  } catch { /* tracking must never break the page */ }
}

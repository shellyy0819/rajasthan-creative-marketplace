export type TrackType = 'view' | 'contact' | 'artist';

/** Fire-and-forget first-party engagement event. Never throws and never delays navigation. */
export function sendEvent(type: TrackType, productId: string): void {
  const body = JSON.stringify({ type, productId });
  try {
    // some browsers throw (not just return false) for beacons with non-safelisted types: fall through to fetch
    if (typeof navigator !== 'undefined' && navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }))) return;
  } catch { /* fall back to fetch */ }
  try {
    void fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  } catch { /* tracking must never break the page */ }
}

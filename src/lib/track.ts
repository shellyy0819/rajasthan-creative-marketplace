export type TrackType = 'view' | 'contact' | 'artist';

/** `source: 'artist'` marks a contact made from the artist page (not about one product): the server does not count it against that product. */
/** Fire-and-forget first-party engagement event. Never throws and never delays navigation. */
export function sendEvent(type: TrackType, productId: string, source?: 'artist'): void {
  const body = JSON.stringify(source ? { type, productId, source } : { type, productId });
  try {
    // some browsers throw (not just return false) for beacons with non-safelisted types: fall through to fetch
    if (typeof navigator !== 'undefined' && navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }))) return;
  } catch { /* fall back to fetch */ }
  try {
    void fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  } catch { /* tracking must never break the page */ }
}

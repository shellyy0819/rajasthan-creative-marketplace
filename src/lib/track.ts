/** What a visitor did inside the contact sheet, one event type per method (each counts once per visitor, product and day). */
export const METHOD_EVENTS = ['contact_call', 'contact_email', 'contact_instagram', 'contact_youtube', 'contact_copy'] as const;
export type MethodEvent = (typeof METHOD_EVENTS)[number];
export type TrackType = 'view' | 'contact' | 'artist' | MethodEvent;

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

/** What a visitor did on a workshop page: looked at it, or reached out to the host (any way, and the way used). Each counts once per visitor, workshop and day. */
export const WORKSHOP_EVENTS = ['view', 'contact', 'contact_whatsapp', 'contact_call', 'contact_instagram', 'contact_website'] as const;
export type WorkshopTrackType = (typeof WORKSHOP_EVENTS)[number];

/** Fire-and-forget first-party event for a workshop (the Trending workshops row). Never throws and never delays navigation. */
export function sendWorkshopEvent(type: WorkshopTrackType, workshopId: string): void {
  const body = JSON.stringify({ type, workshopId });
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }))) return;
  } catch { /* fall back to fetch */ }
  try {
    void fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  } catch { /* tracking must never break the page */ }
}

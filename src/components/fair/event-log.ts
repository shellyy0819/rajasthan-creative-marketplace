import { MAX_EVENTS_PER_CALL, DETAIL_MAX, type FairEventInput, type FairEventKind } from '@/lib/fair-event-kinds';

const MAX_QUEUED = 50;
export type FairLog = { add(kind: FairEventKind, detail: string): void; flush(): void; destroy(): void };

/**
 * Collects what the player does and sends it to the server in small batches: every few seconds, and at once when the page is hidden or closed.
 * It is fire and forget: a failed send is dropped (never retried, never shown), so the game is never slowed or interrupted by it.
 */
export function createFairLog(send: (events: FairEventInput[]) => Promise<unknown> | unknown, opts: { intervalMs?: number } = {}): FairLog {
  const intervalMs = opts.intervalMs ?? 5000;
  let queue: FairEventInput[] = [], timer: ReturnType<typeof setTimeout> | null = null, alive = true;

  const flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    while (queue.length) {
      const batch = queue.splice(0, MAX_EVENTS_PER_CALL);
      try { const r = send(batch); if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch(() => undefined); } catch { /* dropped on purpose */ }
    }
  };
  const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);

  return {
    add(kind, detail) {
      if (!alive) return;
      queue.push({ kind, detail: detail.slice(0, DETAIL_MAX) });
      if (queue.length > MAX_QUEUED) queue = queue.slice(-MAX_QUEUED);
      if (!timer) timer = setTimeout(flush, intervalMs);
    },
    flush,
    destroy() { flush(); alive = false; document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); },
  };
}

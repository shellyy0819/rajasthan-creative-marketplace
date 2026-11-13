'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gaEvent } from '@/lib/analytics';

type LikeInfo = { counts: Record<string, number>; liked: string[] };
type Info = { count: number; liked: boolean };
let pending: Map<string, ((i: Info) => void)[]> | null = null;
export const __resetLikeBatchForTests = () => { pending = null; };

/** All LikeButtons that mount in the same tick share ONE GET /api/likes?ids=…, so a grid of 24 cards costs one request.
 *  The same product can be on the page twice (Trending row + catalog): every waiter for an id is resolved. */
function loadState(id: string): Promise<Info> {
  return new Promise(resolve => {
    if (!pending) {
      const batch = new Map<string, ((i: Info) => void)[]>();
      pending = batch;
      setTimeout(async () => {
        pending = null;
        const settle = (pid: string, info: Info) => batch.get(pid)?.forEach(done => done(info));
        try {
          const r = await fetch(`/api/likes?ids=${encodeURIComponent([...batch.keys()].join(','))}`);
          const data = (await r.json()) as LikeInfo;
          for (const pid of batch.keys()) settle(pid, { count: data.counts[pid] ?? 0, liked: data.liked.includes(pid) });
        } catch { for (const pid of batch.keys()) settle(pid, { count: -1, liked: false }); }
      }, 0);
    }
    pending.set(id, [...(pending.get(id) ?? []), resolve]);
  });
}

export function LikeButton({ productId, initialCount = 0, productName = 'this product' }: { productId: string; initialCount?: number; productName?: string }) {
  const qc = useQueryClient();
  const key = ['like', productId] as const;
  // Still one batched request per tick (see loadState); React Query adds caching, so navigating back shows the hearts at once.
  const { data } = useQuery<Info>({ queryKey: key, queryFn: () => loadState(productId), staleTime: 60_000 });
  const liked = data?.liked ?? false;
  const count = data && data.count >= 0 ? data.count : initialCount;

  type Vars = { next: boolean; before: Info };
  const toggle = useMutation({
    mutationFn: async ({ next }: Vars) => {
      const r = await fetch(`/api/products/${productId}/like`, { method: next ? 'POST' : 'DELETE', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as { liked: boolean; count: number };
    },
    onError: (_e, v) => { qc.setQueryData<Info>(key, v.before); },
    onSuccess: d => { qc.setQueryData<Info>(key, { liked: d.liked, count: d.count }); if (d.liked) gaEvent('like', { item_id: productId }); },
  });
  const busy = toggle.isPending;

  function onClick(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); // the heart sits on a clickable card: never follow its link
    if (busy) return;
    const next = !liked;
    // Optimistic update done synchronously, in the same tick as the click (a mutation's own onMutate runs a tick later).
    const before = qc.getQueryData<Info>(key) ?? { count: initialCount, liked: false };
    void qc.cancelQueries({ queryKey: key });
    qc.setQueryData<Info>(key, { liked: next, count: Math.max(0, count + (next ? 1 : -1)) });
    toggle.mutate({ next, before });
  }

  return (
    <button type="button" className={`like-btn${liked ? ' liked' : ''}`} aria-pressed={liked} aria-busy={busy}
      aria-label={`${liked ? 'Unlike' : 'Like'} ${productName} (${count} ${count === 1 ? 'like' : 'likes'})`} onClick={onClick}>
      {busy ? <span className="rr-spinner" aria-hidden="true" /> : <span aria-hidden="true">{liked ? '♥' : '♡'}</span>} <span className="like-count" aria-hidden="true">{count}</span>
    </button>
  );
}

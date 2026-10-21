'use client';
import { useEffect, useState } from 'react';
import { gaEvent } from '@/lib/analytics';

type LikeInfo = { counts: Record<string, number>; liked: string[] };
let pending: Map<string, (i: { count: number; liked: boolean }) => void> | null = null;
export const __resetLikeBatchForTests = () => { pending = null; };

/** All LikeButtons that mount in the same tick share ONE GET /api/likes?ids=…, so a grid of 24 cards costs one request. */
function loadState(id: string): Promise<{ count: number; liked: boolean }> {
  return new Promise(resolve => {
    if (!pending) {
      const batch = new Map<string, (i: { count: number; liked: boolean }) => void>();
      pending = batch;
      setTimeout(async () => {
        pending = null;
        try {
          const r = await fetch(`/api/likes?ids=${encodeURIComponent([...batch.keys()].join(','))}`);
          const data = (await r.json()) as LikeInfo;
          for (const [pid, done] of batch) done({ count: data.counts[pid] ?? 0, liked: data.liked.includes(pid) });
        } catch { for (const done of batch.values()) done({ count: -1, liked: false }); }
      }, 0);
    }
    pending.set(id, resolve);
  });
}

export function LikeButton({ productId, initialCount = 0, productName = 'this product' }: { productId: string; initialCount?: number; productName?: string }) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadState(productId).then(s => { if (alive) { setLiked(s.liked); if (s.count >= 0) setCount(s.count); } });
    return () => { alive = false; };
  }, [productId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); // the heart sits on a clickable card: never follow its link
    if (busy) return;
    const next = !liked;
    const before = { liked, count };
    setBusy(true); setLiked(next); setCount(c => Math.max(0, c + (next ? 1 : -1)));
    try {
      const r = await fetch(`/api/products/${productId}/like`, { method: next ? 'POST' : 'DELETE', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as { liked: boolean; count: number };
      setLiked(data.liked); setCount(data.count);
      if (data.liked) gaEvent('like', { item_id: productId });
    } catch { setLiked(before.liked); setCount(before.count); }
    setBusy(false);
  }

  return (
    <button type="button" className={`like-btn${liked ? ' liked' : ''}`} aria-pressed={liked} aria-busy={busy}
      aria-label={`${liked ? 'Unlike' : 'Like'} ${productName} (${count} ${count === 1 ? 'like' : 'likes'})`} onClick={toggle}>
      <span aria-hidden="true">{liked ? '♥' : '♡'}</span> <span aria-hidden="true">{count}</span>
    </button>
  );
}

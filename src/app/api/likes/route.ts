import { auth } from '@/auth';
import { VISITOR_COOKIE, isVisitorId, likeActor, readCookie } from '@/lib/actors';
import { handle, json } from '@/lib/api';
import { likeState } from '@/lib/engagement';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) => handle(async () => {
  const ids = (new URL(req.url).searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 200);
  let email: string | null = null;
  try { const s = await auth(); if (s?.user?.email && s.user.active !== false) email = s.user.email; } catch { /* anonymous */ }
  const v = readCookie(req.headers.get('cookie'), VISITOR_COOKIE);
  const actor = email ? likeActor({ email, visitorId: '' }) : isVisitorId(v) ? likeActor({ visitorId: v }) : undefined;
  return json(await likeState(ids, actor), 200, { 'cache-control': 'no-store' });
});

import { auth } from '@/auth';
import { VISITOR_COOKIE, clientIp, isVisitorId, likeActor, newVisitorId, readCookie, visitorCookie } from '@/lib/actors';
import { handle, json } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { likeProduct, unlikeProduct } from '@/lib/engagement';
import * as limits from '@/lib/engagement-limits';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

async function identify(req: Request) {
  let email: string | null = null;
  try { const s = await auth(); if (s?.user?.email && s.user.active !== false) email = s.user.email; } catch { /* anonymous: a broken session must not block liking */ }
  const existing = readCookie(req.headers.get('cookie'), VISITOR_COOKIE);
  const visitorId = isVisitorId(existing) ? existing : newVisitorId();
  return { actor: likeActor({ email, visitorId }), setCookie: isVisitorId(existing) ? null : visitorCookie(visitorId, req.url.startsWith('https://') || req.headers.get('x-forwarded-proto') === 'https') };
}
const guard = (req: Request) => {
  if (!/^application\/json\b/i.test(req.headers.get('content-type') ?? '')) throw new ApiError(415, 'Content-Type must be application/json');
  if (!limits.ipLikeLimiter.hit(clientIp(req.headers))) throw new ApiError(429, 'Too many requests.');
};
const respond = (body: unknown, setCookie: string | null) => json(body, 200, setCookie ? { 'set-cookie': setCookie } : undefined);

export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  guard(req);
  const { actor, setCookie } = await identify(req);
  if (!limits.likeLimiter.hit(actor)) throw new ApiError(429, 'Too many requests.');
  return respond(await likeProduct((await params).id, actor), setCookie);
});
export const DELETE = (req: Request, { params }: Ctx) => handle(async () => {
  guard(req);
  const { actor, setCookie } = await identify(req);
  if (!limits.likeLimiter.hit(actor)) throw new ApiError(429, 'Too many requests.');
  return respond(await unlikeProduct((await params).id, actor), setCookie);
});

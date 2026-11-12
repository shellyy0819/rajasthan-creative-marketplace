import { clientIp, isBot, viewerActor } from '@/lib/actors';
import { handle, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { recordEvent, type EventType } from '@/lib/engagement';
import * as limits from '@/lib/engagement-limits';
import { METHOD_EVENTS } from '@/lib/track';
export const dynamic = 'force-dynamic';
const TYPES: readonly string[] = ['view', 'contact', 'artist', ...METHOD_EVENTS];

export const POST = (req: Request) => handle(async () => {
  if (!/^application\/json\b/i.test(req.headers.get('content-type') ?? '')) throw new ApiError(415, 'Content-Type must be application/json');
  const ip = clientIp(req.headers);
  if (!limits.eventLimiter.hit(ip)) throw new ApiError(429, 'Too many requests.');
  const body = await readJson(req);
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  if (typeof b.type !== 'string' || !TYPES.includes(b.type)) throw new ApiError(400, `type must be one of: ${TYPES.join(', ')}.`);
  if (typeof b.productId !== 'string' || !/^p\d+$/.test(b.productId)) throw new ApiError(400, 'productId must look like p1.');
  if (b.source !== undefined && b.source !== 'artist') throw new ApiError(400, 'source must be artist.');
  const ua = req.headers.get('user-agent');
  if (b.source !== 'artist' && !isBot(ua)) await recordEvent({ productId: b.productId, type: b.type as EventType, actor: viewerActor({ ip, userAgent: ua! }) });
  return new Response(null, { status: 204 });
});

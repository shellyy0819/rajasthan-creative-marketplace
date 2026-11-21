import { clientIp, isBot, viewerActor } from '@/lib/actors';
import { handle, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { recordEvent, recordWorkshopEvent, type EventType } from '@/lib/engagement';
import * as limits from '@/lib/engagement-limits';
import { METHOD_EVENTS, WORKSHOP_EVENTS, type WorkshopTrackType } from '@/lib/track';
export const dynamic = 'force-dynamic';
const TYPES: readonly string[] = ['view', 'contact', 'artist', ...METHOD_EVENTS];
const WORKSHOP_TYPES: readonly string[] = WORKSHOP_EVENTS;

export const POST = (req: Request) => handle(async () => {
  if (!/^application\/json\b/i.test(req.headers.get('content-type') ?? '')) throw new ApiError(415, 'Content-Type must be application/json');
  const ip = clientIp(req.headers);
  if (!limits.eventLimiter.hit(ip)) throw new ApiError(429, 'Too many requests.');
  const body = await readJson(req);
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const ua = req.headers.get('user-agent');
  // A workshop event names a workshop; a product event names a product (never both).
  if (b.workshopId !== undefined) {
    if (b.productId !== undefined) throw new ApiError(400, 'Send either productId or workshopId.');
    if (typeof b.type !== 'string' || !WORKSHOP_TYPES.includes(b.type)) throw new ApiError(400, `type must be one of: ${WORKSHOP_TYPES.join(', ')}.`);
    if (typeof b.workshopId !== 'string' || !/^w\d+$/.test(b.workshopId)) throw new ApiError(400, 'workshopId must look like w1.');
    if (!isBot(ua)) await recordWorkshopEvent({ workshopId: b.workshopId, type: b.type as WorkshopTrackType, actor: viewerActor({ ip, userAgent: ua! }) });
    return new Response(null, { status: 204 });
  }
  if (typeof b.type !== 'string' || !TYPES.includes(b.type)) throw new ApiError(400, `type must be one of: ${TYPES.join(', ')}.`);
  if (typeof b.productId !== 'string' || !/^p\d+$/.test(b.productId)) throw new ApiError(400, 'productId must look like p1.');
  if (b.source !== undefined && b.source !== 'artist') throw new ApiError(400, 'source must be artist.');
  if (b.source !== 'artist' && !isBot(ua)) await recordEvent({ productId: b.productId, type: b.type as EventType, actor: viewerActor({ ip, userAgent: ua! }) });
  return new Response(null, { status: 204 });
});

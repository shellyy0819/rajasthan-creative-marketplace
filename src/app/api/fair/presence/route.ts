import { clientIp, isBot } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { heartbeatCodeLimiter, heartbeatIpLimiter } from '@/lib/fair-limits';
import { heartbeat, parseHeartbeat } from '@/lib/fair-presence';
export const dynamic = 'force-dynamic';

/** A visitor of /fair says where they are; the answer is who else is there. Anyone may call it: no sign-in, no personal data. */
export const POST = (req: Request) => handle(async () => {
  if (isBot(req.headers.get('user-agent'))) throw new ApiError(403, 'Not available.');
  if (!heartbeatIpLimiter.hit(clientIp(req.headers))) throw new ApiError(429, 'Too many requests.');
  const hb = parseHeartbeat(await readJson(req));
  if (!heartbeatCodeLimiter.hit(hb.code)) throw new ApiError(429, 'Too many requests.');
  return json(await heartbeat(hb), 200, { 'cache-control': 'no-store' });
});

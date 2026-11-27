import { isBot, proxyAddress } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { chargeNewCode } from '@/lib/fair-codes';
import { heartbeatCodeLimiter, heartbeatIpLimiter } from '@/lib/fair-limits';
import { heartbeat, parseHeartbeat } from '@/lib/fair-presence';
import { requireFairOpen } from '@/lib/fair-settings';
export const dynamic = 'force-dynamic';

/** A visitor of /fair says where they are; the answer is who else is there. Anyone may call it: no sign-in, no personal data. */
export const POST = (req: Request) => handle(async () => {
  if (isBot(req.headers.get('user-agent'))) throw new ApiError(403, 'Not available.');
  await requireFairOpen();
  const address = proxyAddress(req.headers); // what our proxy saw, not the caller's own X-Forwarded-For entries
  if (!heartbeatIpLimiter.hit(address)) throw new ApiError(429, 'Too many requests.');
  const hb = parseHeartbeat(await readJson(req));
  if (!heartbeatCodeLimiter.hit(hb.code)) throw new ApiError(429, 'Too many requests.');
  await chargeNewCode(hb.code, address);
  return json(await heartbeat(hb), 200, { 'cache-control': 'no-store' });
});

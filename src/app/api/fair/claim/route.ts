import { clientIp, isBot } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { CODE_TAKEN, claimCode, parseClaim } from '@/lib/fair-codes';
import { claimIpLimiter } from '@/lib/fair-limits';
export const dynamic = 'force-dynamic';

/** "Can I be this code?" The first browser to ask owns it; asking again with the same secret is fine, anyone else gets 409. */
export const POST = (req: Request) => handle(async () => {
  if (isBot(req.headers.get('user-agent'))) throw new ApiError(403, 'Not available.');
  if (!claimIpLimiter.hit(clientIp(req.headers))) throw new ApiError(429, 'Too many requests.');
  const claim = parseClaim(await readJson(req));
  if (await claimCode(claim) === 'taken') throw new ApiError(409, CODE_TAKEN);
  return json({ code: claim.code }, 200, { 'cache-control': 'no-store' });
});

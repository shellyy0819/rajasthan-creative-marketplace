import { isBot, proxyAddress } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { chargeNewCode } from '@/lib/fair-codes';
import { questIpLimiter } from '@/lib/fair-limits';
import { listQuestDays, parseClaim } from '@/lib/fair-quest-days';
import { requireFairOpen } from '@/lib/fair-settings';
export const dynamic = 'force-dynamic';

/** A visitor code's quests from earlier days. POST, because the secret that proves the code is yours must not sit in a URL. */
export const POST = (req: Request) => handle(async () => {
  if (isBot(req.headers.get('user-agent'))) throw new ApiError(403, 'Not available.');
  await requireFairOpen();
  const address = proxyAddress(req.headers); // what our proxy saw, not the caller's own X-Forwarded-For entries
  if (!questIpLimiter.hit(address)) throw new ApiError(429, 'Too many requests.');
  const claim = parseClaim(await readJson(req));
  await chargeNewCode(claim.code, address);
  return json({ days: await listQuestDays(claim) }, 200, { 'cache-control': 'no-store' });
});

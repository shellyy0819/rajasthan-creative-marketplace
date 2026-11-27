import { isBot, proxyAddress } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { codeInUse } from '@/lib/fair-codes';
import { parseEvents, recordEvents } from '@/lib/fair-events';
import { eventCodeLimiter, eventIpLimiter, newCodeIpLimiter } from '@/lib/fair-limits';
import { requireFairOpen } from '@/lib/fair-settings';
export const dynamic = 'force-dynamic';

/** What a player did at the exhibition (stalls opened, items shortlisted, activities, quests), in small batches from the browser. No sign-in; the visitor must own the code they send it under. */
export const POST = (req: Request) => handle(async () => {
  if (isBot(req.headers.get('user-agent'))) throw new ApiError(403, 'Not available.');
  await requireFairOpen();
  const address = proxyAddress(req.headers); // the address our proxy saw: the earlier X-Forwarded-For entries are the caller's own words
  if (!eventIpLimiter.hit(address)) throw new ApiError(429, 'Too many requests. Please try again shortly.');
  const e = parseEvents(await readJson(req));
  if (!eventCodeLimiter.hit(e.code)) throw new ApiError(429, 'Too many requests. Please try again shortly.');
  if (!(await codeInUse(e.code)) && !newCodeIpLimiter.hit(address)) throw new ApiError(429, 'Too many requests. Please try again shortly.'); // making a code costs more than using one
  return json(await recordEvents(e), 200, { 'cache-control': 'no-store' });
});

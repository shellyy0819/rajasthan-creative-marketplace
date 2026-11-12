import { clientIp, isBot } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { questIpLimiter } from '@/lib/fair-limits';
import { listQuestDays, parseClaim } from '@/lib/fair-quest-days';
export const dynamic = 'force-dynamic';

/** A visitor code's quests from earlier days. POST, because the secret that proves the code is yours must not sit in a URL. */
export const POST = (req: Request) => handle(async () => {
  if (isBot(req.headers.get('user-agent'))) throw new ApiError(403, 'Not available.');
  if (!questIpLimiter.hit(clientIp(req.headers))) throw new ApiError(429, 'Too many requests.');
  return json({ days: await listQuestDays(parseClaim(await readJson(req))) }, 200, { 'cache-control': 'no-store' });
});

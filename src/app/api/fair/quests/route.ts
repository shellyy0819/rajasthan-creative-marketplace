import { clientIp, isBot } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { questIpLimiter } from '@/lib/fair-limits';
import { parseQuestSave, saveQuestDay } from '@/lib/fair-quest-days';
export const dynamic = 'force-dynamic';

/** Saves today's quest progress under a visitor code. Only the owner of the code can save. */
export const POST = (req: Request) => handle(async () => {
  if (isBot(req.headers.get('user-agent'))) throw new ApiError(403, 'Not available.');
  if (!questIpLimiter.hit(clientIp(req.headers))) throw new ApiError(429, 'Too many requests.');
  await saveQuestDay(parseQuestSave(await readJson(req)));
  return new Response(null, { status: 204 });
});

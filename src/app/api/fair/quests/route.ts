import { isBot, proxyAddress } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { chargeNewCode } from '@/lib/fair-codes';
import { questIpLimiter } from '@/lib/fair-limits';
import { parseQuestSave, saveQuestDay } from '@/lib/fair-quest-days';
import { requireFairOpen } from '@/lib/fair-settings';
export const dynamic = 'force-dynamic';

/** Saves today's quest progress under a visitor code. Only the owner of the code can save. */
export const POST = (req: Request) => handle(async () => {
  if (isBot(req.headers.get('user-agent'))) throw new ApiError(403, 'Not available.');
  await requireFairOpen();
  const address = proxyAddress(req.headers); // what our proxy saw, not the caller's own X-Forwarded-For entries
  if (!questIpLimiter.hit(address)) throw new ApiError(429, 'Too many requests.');
  const save = parseQuestSave(await readJson(req));
  await chargeNewCode(save.code, address);
  await saveQuestDay(save);
  return new Response(null, { status: 204 });
});

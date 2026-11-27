import { isBot, proxyAddress } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { chargeNewCode } from '@/lib/fair-codes';
import { noteCodeLimiter, noteIpLimiter } from '@/lib/fair-limits';
import { createNote, parseNote } from '@/lib/fair-notes';
import { requireFairOpen } from '@/lib/fair-settings';
export const dynamic = 'force-dynamic';

/** A feedback note from the exhibition's mirror, for the Craftofy team. No sign-in; the visitor must own the code they send it under. */
export const POST = (req: Request) => handle(async () => {
  if (isBot(req.headers.get('user-agent'))) throw new ApiError(403, 'Not available.');
  await requireFairOpen();
  const address = proxyAddress(req.headers); // what our proxy saw, not the caller's own X-Forwarded-For entries
  if (!noteIpLimiter.hit(address)) throw new ApiError(429, 'You have sent a lot of notes. Please try again later.');
  const note = parseNote(await readJson(req));
  if (!noteCodeLimiter.hit(note.code)) throw new ApiError(429, 'You have sent a lot of notes. Please try again later.');
  await chargeNewCode(note.code, address);
  return json(await createNote(note), 201, { 'cache-control': 'no-store' });
});

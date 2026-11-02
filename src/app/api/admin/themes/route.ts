import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { bad, obj } from '@/lib/validate';
import { toDto } from '@/lib/themes/dto';
import { isPresetKey } from '@/lib/themes/presets';
import { stateOf } from '@/lib/themes/resolve';
import { createTheme, getBase, listThemes } from '@/lib/themes/store';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'cache-control': 'no-store' };
export const GET = () => handle(async () => {
  requireAdmin(await auth());
  const now = new Date();
  const [base, rows] = await Promise.all([getBase(), listThemes()]);
  const live = rows.filter(r => stateOf(r, now) === 'live')
    .sort((a, b) => b.startsAt!.getTime() - a.startsAt!.getTime() || b.id - a.id)[0];
  return json({ base: toDto(base, now), themes: rows.map(r => toDto(r, now)), live: live?.id ?? null }, 200, NO_STORE);
});
export const POST = (req: Request) => handle(async () => {
  const admin = requireAdmin(await auth());
  const b = obj(await readJson(req) as never) as { preset?: unknown };
  if (!isPresetKey(b.preset)) throw bad('Unknown preset.');
  return json(toDto(await createTheme(b.preset, admin.email)), 201, NO_STORE);
});

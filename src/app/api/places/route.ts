import { auth } from '@/auth';
import { clientIp } from '@/lib/actors';
import { handle, json } from '@/lib/api';
import { requireUser } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import { searchPlaces } from '@/lib/places';
export const dynamic = 'force-dynamic';

// The free Photon service is fair-use only: cap each signed-in user at 60 lookups a minute.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, number[]>();
export const resetPlacesRateLimit = () => hits.clear();
function limit(email: string) {
  const now = Date.now();
  const recent = (hits.get(email.toLowerCase()) ?? []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) throw new ApiError(429, 'Too many place searches. Please wait a moment.');
  hits.set(email.toLowerCase(), [...recent, now]);
}

/**
 * Place suggestions for the pickup-location field. Any signed-in account (onboarding uses it before a role exists; it proxies a third-party service).
 * City search alone is also open to visitors (the public host-a-workshop form), limited per network address.
 */
export const GET = (req: Request) => handle(async () => {
  const params = new URL(req.url).searchParams;
  const cityOnly = params.get('type') === 'city';
  const session = await auth();
  const key = session?.user?.email || !cityOnly ? requireUser(session).email : `ip:${clientIp(req.headers)}`;
  const q = params.get('q') ?? '';
  if (q.trim().length < 2) return json([], 200, { 'cache-control': 'private, max-age=60' });
  limit(key);
  const found = cityOnly ? await searchPlaces(q, undefined, { cityOnly: true }) : await searchPlaces(q);
  return json(found, 200, { 'cache-control': 'private, max-age=300' });
});

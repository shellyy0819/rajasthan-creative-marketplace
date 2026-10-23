import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireStaff } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import { searchPlaces } from '@/lib/places';
export const dynamic = 'force-dynamic';

// The free Photon service is fair-use only: cap each signed-in seller/admin at 60 lookups a minute.
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

/** Place suggestions for the pickup-location field. Sellers and admins only (it proxies a third-party service). */
export const GET = (req: Request) => handle(async () => {
  const user = requireStaff(await auth());
  const params = new URL(req.url).searchParams;
  const q = params.get('q') ?? '';
  if (q.trim().length < 2) return json([], 200, { 'cache-control': 'private, max-age=60' });
  limit(user.email);
  const found = params.get('type') === 'city' ? await searchPlaces(q, undefined, { cityOnly: true }) : await searchPlaces(q);
  return json(found, 200, { 'cache-control': 'private, max-age=300' });
});

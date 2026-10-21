import { handle, json } from '@/lib/api';
import { trending } from '@/lib/trending';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) => handle(async () => {
  const raw = new URL(req.url).searchParams.get('limit');
  const n = raw === null ? undefined : Number(raw);
  return json(await trending({ limit: n }), 200, { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' });
});

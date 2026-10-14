import { handle, json } from '@/lib/api';
import { listProducts } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => handle(async () => {
  const sp = new URL(req.url).searchParams;
  return json(await listProducts({ city: sp.get('city') ?? undefined, category: sp.get('category') ?? undefined, q: sp.get('q') ?? undefined }));
});

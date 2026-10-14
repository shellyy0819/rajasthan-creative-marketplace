import { handle, json } from '@/lib/api';
import { listWorkshops } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => handle(async () => {
  const sp = new URL(req.url).searchParams;
  return json(await listWorkshops({ city: sp.get('city') ?? undefined, type: sp.get('type') ?? undefined, q: sp.get('q') ?? undefined }));
});

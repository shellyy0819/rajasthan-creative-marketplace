import { getProductBySlug } from '@/lib/catalog';
import { shareImage } from '@/lib/share-image';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ slug: string }> };

/** The small picture link previews show for a product: its first photo scaled to 1200x630. 404 when there is none (the page then uses its generated card). */
export async function GET(_req: Request, { params }: Ctx) {
  const p = await getProductBySlug((await params).slug);
  const img = p && (await shareImage(p));
  if (!img) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(img), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=3600, s-maxage=86400' } });
}

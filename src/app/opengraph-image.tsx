import { capitalize, getCatalogWording } from '@/lib/catalog-wording';
import { renderOg, ogSize } from '@/lib/og';
export const alt = 'Craftofy — products and creative workshops';
export const size = ogSize;
export const contentType = 'image/png';
export default async function Image() {
  const w = await getCatalogWording();
  return renderOg('Discover the Craft. Meet the Maker. Learn the Art.', `${capitalize(w.finds)} & workshops across India`);
}

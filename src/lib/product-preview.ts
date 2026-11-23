/**
 * What a product card already knows (name, price, photo, maker), kept for the moment between the click and the product page arriving,
 * so the page frame can show the real title and photo at once instead of an empty skeleton. Kept in memory and in sessionStorage
 * (so a reload of the loading screen still has it); both are best effort: without them the page shows plain placeholders.
 */
export type ProductPreview = { name: string; category: string; pricePaise: number | null; imageUrl?: string; seller: string; city: string; variant: number };

const KEY = 'product-preview:';
const mem = new Map<string, ProductPreview>();
const MAX = 40;

export function rememberPreview(path: string, preview: ProductPreview): void {
  if (mem.size >= MAX) mem.delete(mem.keys().next().value as string);
  mem.set(path, preview);
  try { sessionStorage.setItem(KEY + path, JSON.stringify(preview)); } catch { /* storage blocked: the in-memory copy is enough */ }
}

export function readPreview(path: string): ProductPreview | undefined {
  const hit = mem.get(path);
  if (hit) return hit;
  try {
    const raw = sessionStorage.getItem(KEY + path);
    return raw ? (JSON.parse(raw) as ProductPreview) : undefined;
  } catch { return undefined; }
}

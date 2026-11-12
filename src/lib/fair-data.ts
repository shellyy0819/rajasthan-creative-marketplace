import { artistKey } from './artist';
import { listProducts, productSlug } from './catalog';
import { hash32, rng } from './fair-characters';
import { getFairSettings } from './fair-settings';
import { sampleFairData } from './fair-sample';
import type { ArtKind, CraftKind, FairData, FairItem, FairMaker, MakerLook } from './fair-types';
import type { Product } from './types';

/** The exhibition has two rows of four stalls. */
export const MAX_STALLS = 8;
export const MAX_ITEMS = 4;
const TOPS = ['orange', 'green', 'indigo', 'mustard', 'sage'], ACCS = ['mustard', 'chalk', 'orange'];
const FLOWER = /flower|rose|lotus|tulip|lily|marigold/i, EARRING = /earring|jhumk|chandbali|stud/i;

export function artFor(p: Pick<Product, 'name' | 'category'>): ArtKind {
  if (EARRING.test(p.name)) return 'drop';
  const c = p.category.toLowerCase();
  if (c.includes('crochet')) return FLOWER.test(p.name) ? 'lily' : 'frock';
  if (c.includes('pottery')) return 'pot';
  if (c.includes('resin')) return 'coaster';
  if (c.includes('textile') || /stole|dupatta|saree|scarf/i.test(p.name)) return 'stole';
  if (c.includes('accessor')) return 'bands';
  return 'box';
}
export function craftFor(category: string): CraftKind {
  const c = category.toLowerCase();
  return c.includes('crochet') ? 'crochet' : c.includes('pottery') ? 'pottery' : c.includes('resin') ? 'resin' : c.includes('accessor') || c.includes('jewel') ? 'jewellery' : c.includes('textile') || c.includes('print') ? 'print' : 'handmade';
}
const FLOWERS = ['#e58aa6', '#b3262e', '#f29a1f', '#7a4e8f'];

/** Turns approved products into stalls: the sellers with the most products first, at most 8 stalls of 4 items. Pure, so it is easy to test. */
export function buildRealMakers(products: Product[]): FairMaker[] {
  const by = new Map<string, Product[]>();
  for (const p of products) { const k = artistKey(p.seller); by.set(k, [...(by.get(k) ?? []), p]); }
  const groups = [...by.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, MAX_STALLS);
  const makers = groups.map(([key, list]) => {
    const r = rng(hash32(key)), first = list[0];
    const look: MakerLook = { skin: r() < .5 ? 'skin' : 'skin-2', top: TOPS[Math.floor(r() * TOPS.length)], acc: ACCS[Math.floor(r() * ACCS.length)], long: r() < .5, bun: r() < .4 };
    const items: FairItem[] = list.slice(0, MAX_ITEMS).map((p, i) => ({
      key: `${key}:${i}`, name: p.name, pricePaise: p.pricePaise, art: artFor(p), color: FLOWERS[hash32(p.name) % FLOWERS.length],
      href: `/products/${productSlug(p)}`, ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
    }));
    const maker: FairMaker = {
      id: key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'maker', name: first.seller, city: first.city, craft: craftFor(first.category), category: first.category, look,
      greet: `Welcome to ${first.seller}! Have a look around.`, thanks: 'Thank you so much!', items,
      ...(first.sellerSlug ? { href: `/artists/${first.sellerSlug}` } : {}),
    };
    return maker;
  });
  const i = makers.findIndex(m => m.items.some(it => it.art === 'drop'));
  const at = i >= 0 ? i : makers.length ? Math.min(1, makers.length - 1) : -1;
  if (at >= 0) makers[at] = { ...makers[at], mirror: true };
  return makers;
}

/** What /fair shows: the invented sample makers, or live sellers, as the admin chose on the Settings page. */
export async function getFairData(): Promise<FairData> {
  const { source } = await getFairSettings();
  if (source === 'sample') return sampleFairData();
  return { source: 'real', makers: buildRealMakers(await listProducts()) };
}

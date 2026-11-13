import { artistKey } from './artist';
import { listProducts, productSlug } from './catalog';
import { hash32, rng } from './fair-characters';
import { getFairSettings } from './fair-settings';
import { sampleFairData } from './fair-sample';
import { DEFAULT_STALLS, OPEN_LABEL, STALL_COUNT, fillStalls, makersOf } from './fair-stalls';
import type { ArtKind, CraftKind, FairData, FairItem, FairMaker, FairStall, MakerLook } from './fair-types';
import type { Product } from './types';

export const MAX_STALLS = STALL_COUNT;
export const MAX_ITEMS = 4;
const MAX_ITEMS_EACH = MAX_ITEMS;
const TOPS = ['orange', 'green', 'indigo', 'mustard', 'sage'], ACCS = ['mustard', 'chalk', 'orange'];
const FLOWER = /flower|rose|lotus|tulip|lily|marigold/i, EARRING = /earring|jhumk|chandbali|stud/i;
const FLOWERS = ['#e58aa6', '#b3262e', '#f29a1f', '#7a4e8f'], CLOTH = ['#b3262e', '#35506f', '#405746', '#7a4e8f', '#c66b43'];

export function artFor(p: Pick<Product, 'name' | 'category'>): ArtKind {
  const c = `${p.category} ${p.name}`.toLowerCase();
  if (EARRING.test(p.name)) return 'drop';
  if (/christmas|xmas|santa/.test(c)) return /stocking|sock/.test(c) ? 'stocking' : /star|ornament|bauble|bell/.test(c) ? 'ornament' : 'tree';
  if (/wood/.test(c)) return /toy|elephant|horse|camel|animal/.test(c) ? 'woodtoy' : 'woodbox';
  const n = p.name.toLowerCase(); // the product's own name wins over its category (a suit in the "Sarees and suits" category is a suit)
  if (/suit|kurta|salwar/.test(n)) return 'suit';
  if (/dupatta|stole|scarf/.test(n)) return 'stole';
  if (/saree|sari\b|lehenga/.test(n)) return 'saree';
  if (/saree|sari\b|lehenga/.test(c)) return 'saree';
  if (/suit|kurta|salwar/.test(c)) return 'suit';
  if (/dupatta|stole|scarf/.test(c)) return 'stole';
  if (c.includes('crochet')) return FLOWER.test(p.name) ? 'lily' : 'frock';
  if (c.includes('pottery')) return 'pot';
  if (c.includes('resin')) return 'coaster';
  if (c.includes('textile')) return 'stole';
  if (c.includes('accessor')) return 'bands';
  return 'box';
}
export function craftFor(category: string): CraftKind {
  const c = category.toLowerCase();
  return /christmas|xmas|santa/.test(c) ? 'christmas' : c.includes('wood') ? 'wood' : c.includes('crochet') ? 'crochet' : c.includes('pottery') ? 'pottery' : c.includes('resin') ? 'resin'
    : c.includes('accessor') || c.includes('jewel') ? 'jewellery' : /textile|print|saree|sari|suit|kurta|dupatta/.test(c) ? 'print' : 'handmade';
}

function makerFrom(key: string, list: Product[]): FairMaker {
  const r = rng(hash32(key)), first = list[0];
  const look: MakerLook = { skin: r() < .5 ? 'skin' : 'skin-2', top: TOPS[Math.floor(r() * TOPS.length)], acc: ACCS[Math.floor(r() * ACCS.length)], long: r() < .5, bun: r() < .4 };
  const items: FairItem[] = list.slice(0, MAX_ITEMS_EACH).map((p, i) => ({
    key: `${key}:${i}`, name: p.name, pricePaise: p.pricePaise ?? 0, art: artFor(p),
    color: artFor(p) === 'saree' || artFor(p) === 'suit' || artFor(p) === 'stole' ? CLOTH[hash32(p.name) % CLOTH.length] : FLOWERS[hash32(p.name) % FLOWERS.length],
    href: `/products/${productSlug(p)}`, ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
  }));
  return {
    id: key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'maker', name: first.seller, city: first.city, craft: craftFor(`${first.category} ${first.name}`), category: first.category, look,
    greet: `Welcome to ${first.seller}! Have a look around.`, thanks: 'Thank you so much!', items,
    ...(first.sellerSlug ? { href: `/artists/${first.sellerSlug}` } : {}),
  };
}
const WEARABLE = new Set<ArtKind>(['drop', 'chandbali', 'saree', 'suit', 'stole']);

/**
 * The floor plan from live approved products. The first five places are the default stalls (crochet, resin, wood, sarees and suits, Christmas):
 * each goes to the seller with the most matching products, and stays an open stall named for its category when nobody sells that yet.
 * The remaining places go to other sellers, busiest first. Pure, so it is easy to test.
 */
export function buildRealStalls(products: Product[]): FairStall[] {
  const bySeller = new Map<string, Product[]>();
  // The fair is a shopping game, so products without a price are left out of the stalls.
  for (const p of products) { if (p.pricePaise == null) continue; const k = artistKey(p.seller); bySeller.set(k, [...(bySeller.get(k) ?? []), p]); }
  const used = new Set<string>(), stalls: FairStall[] = [];
  for (const d of DEFAULT_STALLS) {
    let best: { key: string; list: Product[] } | null = null;
    for (const [key, list] of bySeller) {
      if (used.has(key)) continue;
      const hit = list.filter(p => d.match.test(`${p.category} ${p.name}`));
      if (hit.length && (!best || hit.length > best.list.length || (hit.length === best.list.length && key < best.key))) best = { key, list: hit };
    }
    if (best) { used.add(best.key); stalls.push({ maker: makerFrom(best.key, best.list), label: d.label }); } else stalls.push({ maker: null, label: d.label });
  }
  const rest = [...bySeller.entries()].filter(([k]) => !used.has(k)).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  for (const [key, list] of rest) { if (stalls.length >= STALL_COUNT) break; stalls.push({ maker: makerFrom(key, list), label: OPEN_LABEL }); }
  return markMirror(fillStalls(stalls));
}
/** Exactly one stall gets the mirror: the first with something to wear (a saree, a suit, earrings), else the first maker. */
export function markMirror(stalls: FairStall[]): FairStall[] {
  const makers = makersOf(stalls);
  const pick = makers.find(m => m.items.some(i => WEARABLE.has(i.art))) ?? makers[0];
  return stalls.map(s => (s.maker ? { ...s, maker: { ...s.maker, mirror: s.maker === pick } } : s));
}
export const buildRealMakers = (products: Product[]): FairMaker[] => makersOf(buildRealStalls(products));

/** What /fair shows: the invented sample makers, or live sellers, as the admin chose on the Settings page. */
export async function getFairData(): Promise<FairData> {
  const { source } = await getFairSettings();
  if (source === 'sample') return sampleFairData();
  const stalls = buildRealStalls(await listProducts());
  return { source: 'real', stalls, makers: makersOf(stalls) };
}

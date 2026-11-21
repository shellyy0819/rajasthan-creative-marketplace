import { isHandmade } from './handmade';
import type { Artist } from './artists';
import type { Workshop } from './types';

type Listing = Pick<Workshop, 'kind' | 'mode'>;
/** The same test the workshop page uses to pick its layout: a class, or anything held online, is shown as a class with an instructor. */
const isClass = (w: Listing) => w.kind === 'class' || w.mode === 'online';

/** "classes", "workshops" or "classes and workshops", from the kinds of listing the person hosts. */
export function listingNoun(list: Listing[]): string {
  if (list.every(isClass)) return 'classes';
  if (!list.some(isClass)) return 'workshops';
  return 'classes and workshops';
}

/** The topic every listing shares (Yoga, Crochet, ...), if there is exactly one. */
export function sharedTopic(list: Pick<Workshop, 'topic'>[]): string | undefined {
  const names = new Set(list.map(w => w.topic?.name));
  const [only] = names.size === 1 ? [...names] : [];
  return only || undefined;
}

/**
 * The small heading above the name. Anyone who sells pieces is "the maker" (also when they teach too); a person who only teaches or hosts is
 * "your instructor" when everything they run is a class, otherwise "your host", matching the label on their workshop pages.
 */
export function profileEyebrow(a: Pick<Artist, 'products' | 'workshops'>): 'MEET THE MAKER' | 'MEET YOUR INSTRUCTOR' | 'MEET YOUR HOST' {
  if (a.products.length > 0) return 'MEET THE MAKER';
  const list = a.workshops ?? [];
  return list.length > 0 && list.every(isClass) ? 'MEET YOUR INSTRUCTOR' : 'MEET YOUR HOST';
}

/** What the page is about: a maker who sells (with or without classes), or a person who only hosts classes and workshops. */
export const isHostOnly = (a: Pick<Artist, 'products'>) => a.products.length === 0;

/** Page has something worth indexing: a piece for sale or a class or workshop that is still on. */
export const hasContent = (a: Pick<Artist, 'products' | 'workshops'>) => a.products.length > 0 || (a.workshops?.length ?? 0) > 0;

/** The title and description of a profile. A maker keeps the wording the page always had; a host with no products is described by what they teach. */
export function artistMeta(a: Artist): { title: string; description: string } {
  const list = a.workshops ?? [];
  if (!isHostOnly(a)) {
    const allHandmade = a.products.every(isHandmade);
    const also = list.length ? ` Also hosts ${list.length} ${listingNoun(list)}.` : '';
    return {
      // "Handmade" is claimed only when every product on the page counts as handmade.
      title: allHandmade ? `${a.name} — handmade by an independent artist` : `${a.name} — an independent artist`,
      description: `${a.products[0].description} Shop ${a.products.length} ${allHandmade ? 'handmade ' : ''}${a.products.length === 1 ? 'piece' : 'pieces'} by ${a.name}.${also}`,
    };
  }
  const noun = listingNoun(list.length ? list : [{ kind: 'workshop', mode: 'in_person' }]);
  const topic = sharedTopic(list);
  const where = list.length && list.every(w => w.mode === 'online') ? 'online' : a.city ? `in ${a.city}` : '';
  const what = `${topic ? `${topic} ` : ''}${noun}`;
  return {
    title: `${a.name} — ${what}${where ? ` ${where}` : ''}`,
    description: `${a.name} hosts ${what}${where ? ` ${where}` : ''}.${list.length ? ` See ${list.length === 1 ? 'the' : `${list.length}`} upcoming ${list.length === 1 ? 'listing' : 'listings'} and reserve a spot.` : ''}`,
  };
}

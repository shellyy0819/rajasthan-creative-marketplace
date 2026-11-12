import type { FairItem } from '@/lib/fair-types';

/** Something a visitor can try on at the mirror: earrings, or an outfit that changes the colours they wear. */
export type Wear = { kind: 'ear'; art: 'drop' | 'chandbali'; color: string } | { kind: 'outfit'; top?: string; acc?: string };
export function wearFor(item: FairItem | null | undefined): Wear | null {
  if (!item) return null;
  const c = item.color ?? '#b3262e';
  switch (item.art) {
    case 'drop': return { kind: 'ear', art: 'drop', color: c };
    case 'chandbali': return { kind: 'ear', art: 'chandbali', color: c };
    case 'saree': return { kind: 'outfit', top: c, acc: '#d9a441' };
    case 'suit': return { kind: 'outfit', top: c, acc: '#fbf7ef' };
    case 'stole': return { kind: 'outfit', acc: c };
    default: return null;
  }
}
export const isWearable = (item: FairItem) => wearFor(item) !== null;

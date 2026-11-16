import type { Product } from './types';

/** Only a product whose sourcing type counts as handmade may be called handmade. A product with no type yet is not claimed either way. */
export const isHandmade = (p: Pick<Product, 'sourcing'>): boolean => !!p.sourcing?.countsAsHandmade;

/** Who stands behind a product, in words that are true for how it was sourced: "Handmade by", "Curated by", "Resold by", or "Sold by" when no type is set. */
export const madeByPhrase = (p: Pick<Product, 'sourcing'>): string => (isHandmade(p) ? 'Handmade by' : p.sourcing ? `${p.sourcing.name} by` : 'Sold by');

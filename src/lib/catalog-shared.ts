// Client-safe catalog helpers (no fs / db imports).
import { slugify } from './slug';
import type { Product, Workshop } from './types';

/** Fallback/starter list: the live list is the `categories` table (see lib/categories.ts). */
export const DEFAULT_CATEGORIES = ['Crochet & Textiles', 'Accessories', 'Resin Art', 'Pottery'] as const;

/** Starter sourcing types (mirrors migration 0024; the live list is the `sourcing_types` table, see lib/sourcing-types.ts). */
export const DEFAULT_SOURCING_TYPES = [
  { name: 'Handmade', countsAsHandmade: true, showBadge: false },
  { name: 'Curated', countsAsHandmade: false, showBadge: true },
  { name: 'Resold', countsAsHandmade: false, showBadge: true },
] as const;

/** How many products the home shelf shows at first, and how many each scroll adds. Also the most the products API returns per request. */
export const SHELF_PAGE_SIZE = 8;
export const PRODUCTS_PAGE_MAX = 48;

export const productSlug = (p: Product) => `${slugify(p.name)}-${p.id}`;
export const workshopSlug = (w: Workshop) => `${slugify(w.title)}-${w.id}`;

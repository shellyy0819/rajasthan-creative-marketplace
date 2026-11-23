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

/** How many products the home shelf shows, and no more: /shop has the rest, with the filters. An admin can change it (Settings > Home page) within these bounds. */
export const DEFAULT_HOME_PRODUCT_LIMIT = 30;
export const MIN_HOME_PRODUCT_LIMIT = 4;
export const MAX_HOME_PRODUCT_LIMIT = 48;
/** The home page's workshop section only appears once at least this many workshops are on (0 = always). An admin can change it (Settings > Home page). */
export const DEFAULT_HOME_MIN_WORKSHOPS = 10;
export const MIN_HOME_MIN_WORKSHOPS = 0;
export const MAX_HOME_MIN_WORKSHOPS = 100;
/** How many products /shop shows at first and adds per scroll (three rows of four). */
export const SHOP_PAGE_SIZE = 12;
export const PRODUCTS_PAGE_MAX = 48;

export const productSlug = (p: Product) => `${slugify(p.name)}-${p.id}`;
export const workshopSlug = (w: Workshop) => `${slugify(w.title)}-${w.id}`;

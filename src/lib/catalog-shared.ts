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

export const productSlug = (p: Product) => `${slugify(p.name)}-${p.id}`;
export const workshopSlug = (w: Workshop) => `${slugify(w.title)}-${w.id}`;

// Client-safe catalog helpers (no fs / db imports).
import { slugify } from './slug';
import type { Product, Workshop } from './types';

export const CITIES = ['Udaipur', 'Jaipur', 'Jodhpur'] as const;
/** Fallback/starter list: the live list is the `categories` table (see lib/categories.ts). */
export const DEFAULT_CATEGORIES = ['Crochet & Textiles', 'Accessories', 'Resin Art', 'Pottery'] as const;

export const citySlug = (city: string) => slugify(city);
export const cityFromSlug = (slug: string) => CITIES.find(c => citySlug(c) === slug);

export const productSlug = (p: Product) => `${slugify(p.name)}-${p.id}`;
export const workshopSlug = (w: Workshop) => `${slugify(w.title)}-${w.id}`;

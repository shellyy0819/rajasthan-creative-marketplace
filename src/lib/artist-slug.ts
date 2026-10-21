import { slugify } from './slug';

/** "<name>-<first 8 hex of the seller id>": identifies an artist page without exposing the full id. */
export const artistSlug = (name: string, sellerId: string) => `${slugify(name) || 'artist'}-${sellerId.replace(/-/g, '').slice(0, 8).toLowerCase()}`;
export const artistIdPrefix = (slug: string) => /-([0-9a-f]{8})$/.exec(slug)?.[1];

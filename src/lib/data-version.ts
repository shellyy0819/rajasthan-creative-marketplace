import { randomUUID } from 'node:crypto';
import { unstable_cache } from 'next/cache';

/**
 * A token that stays the same until something is changed. It is cached with no time limit, so it is only recreated when an admin or
 * a seller saves a change (every write calls revalidatePath('/', 'layout')). The browser keys what it has fetched for the home, shop
 * and workshops pages by this token, so a new token is the one thing that makes it fetch again.
 */
export const getDataVersion = unstable_cache(async () => randomUUID(), ['data-version'], { tags: ['data-version'] });

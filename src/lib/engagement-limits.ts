import { createLimiter } from './rate-limit';
export let likeLimiter = createLimiter(30, 60_000);
/** Per network address, across all visitor ids: a client that drops the cookie cannot mint unlimited actors. */
export let ipLikeLimiter = createLimiter(120, 60_000);
export let eventLimiter = createLimiter(120, 60_000);
/** Public listing-request form: 5 per hour per network address. */
export let listingLimiter = createLimiter(5, 3_600_000);
/** Product photo upload permissions: 60 per hour per signed-in user. */
export let uploadLimiter = createLimiter(60, 3_600_000);
export const resetListingLimiterForTests = () => { listingLimiter = createLimiter(5, 3_600_000); };
export const resetLimitersForTests = () => { uploadLimiter = createLimiter(60, 3_600_000); listingLimiter = createLimiter(5, 3_600_000); likeLimiter = createLimiter(30, 60_000); ipLikeLimiter = createLimiter(120, 60_000); eventLimiter = createLimiter(120, 60_000); };

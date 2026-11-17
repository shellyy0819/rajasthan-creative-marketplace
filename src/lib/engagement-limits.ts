import { createLimiter } from './rate-limit';
export let likeLimiter = createLimiter(30, 60_000);
/** Per network address, across all visitor ids: a client that drops the cookie cannot mint unlimited actors. */
export let ipLikeLimiter = createLimiter(120, 60_000);
export let eventLimiter = createLimiter(120, 60_000);
/** Public listing-request form: 5 per hour per network address. */
export let listingLimiter = createLimiter(5, 3_600_000);
/** Public host-a-workshop form: 5 per hour per network address. */
export let workshopRequestLimiter = createLimiter(5, 3_600_000);
/** Confirming or re-sending a host-a-workshop email code: 30 per hour per network address. */
export let workshopVerifyLimiter = createLimiter(30, 3_600_000);
/** Photo upload permissions for the public host-a-workshop form: 12 per hour per network address (3 photos, a few tries). */
export let requestUploadLimiter = createLimiter(12, 3_600_000);
/** Product photo upload permissions: 60 per hour per signed-in user. */
export let uploadLimiter = createLimiter(60, 3_600_000);
/** Seller logo upload permissions: 20 per hour per signed-in user. */
export let logoLimiter = createLimiter(20, 3_600_000);
/** Seller onboarding submissions: 10 per hour per account, 30 per hour per network address. */
export let onboardingLimiter = createLimiter(10, 3_600_000);
export let ipOnboardingLimiter = createLimiter(30, 3_600_000);
/** Emails to makers: 5 per hour per network address, and 2 per day for one buyer address and one product. */
export let enquiryLimiter = createLimiter(5, 3_600_000);
export let enquiryPairLimiter = createLimiter(2, 86_400_000);
/** Anonymous emails only, keyed on things the sender cannot choose: 10 per day per product and 100 per hour in all (the client address and the typed email can be faked). */
export let enquiryProductLimiter = createLimiter(10, 86_400_000);
export let enquiryAnonLimiter = createLimiter(100, 3_600_000);
export const resetListingLimiterForTests = () => { listingLimiter = createLimiter(5, 3_600_000); };
export const resetLimitersForTests = () => { logoLimiter = createLimiter(20, 3_600_000); onboardingLimiter = createLimiter(10, 3_600_000); ipOnboardingLimiter = createLimiter(30, 3_600_000); uploadLimiter = createLimiter(60, 3_600_000); listingLimiter = createLimiter(5, 3_600_000); workshopRequestLimiter = createLimiter(5, 3_600_000); requestUploadLimiter = createLimiter(12, 3_600_000); workshopVerifyLimiter = createLimiter(30, 3_600_000); likeLimiter = createLimiter(30, 60_000); ipLikeLimiter = createLimiter(120, 60_000); eventLimiter = createLimiter(120, 60_000); enquiryLimiter = createLimiter(5, 3_600_000); enquiryPairLimiter = createLimiter(2, 86_400_000); enquiryProductLimiter = createLimiter(10, 86_400_000); enquiryAnonLimiter = createLimiter(100, 3_600_000); };

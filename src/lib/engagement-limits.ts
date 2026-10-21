import { createLimiter } from './rate-limit';
export let likeLimiter = createLimiter(30, 60_000);
export let eventLimiter = createLimiter(120, 60_000);
export const resetLimitersForTests = () => { likeLimiter = createLimiter(30, 60_000); eventLimiter = createLimiter(120, 60_000); };

import { createLimiter } from './rate-limit';
/** Heartbeats: a tab sends one every ~2.5 seconds (4 per 10 s). Per network address, so a household or office with several players fits. */
export let heartbeatIpLimiter = createLimiter(60, 10_000);
/** Per visitor code, so one code cannot be driven faster than a real tab. */
export let heartbeatCodeLimiter = createLimiter(12, 10_000);

import { createLimiter } from './rate-limit';
/** Heartbeats: a tab sends one every ~2.5 seconds (4 per 10 s). Per network address, so a household or office with several players fits. */
export let heartbeatIpLimiter = createLimiter(60, 10_000);
/** Per visitor code, so one code cannot be driven faster than a real tab. */
export let heartbeatCodeLimiter = createLimiter(12, 10_000);
/** Choosing a code ("is it taken?"): per network address, so codes cannot be guessed in bulk. */
export let claimIpLimiter = createLimiter(30, 60_000);
/** Notes left for admins: 10 an hour per network address and 5 an hour per code. */
export let noteIpLimiter = createLimiter(10, 3_600_000);
export let noteCodeLimiter = createLimiter(5, 3_600_000);
/** Saving and reading quest progress: per network address. */
export let questIpLimiter = createLimiter(120, 60_000);

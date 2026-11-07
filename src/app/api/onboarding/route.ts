import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { clientIp } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { requireUser } from '@/lib/authz';
import * as limits from '@/lib/engagement-limits';
import { ApiError } from '@/lib/errors';
import { completeOnboarding } from '@/lib/onboarding';
import { validateOnboarding } from '@/lib/onboarding-validate';
import { storageConfig } from '@/lib/storage';
export const dynamic = 'force-dynamic';

/** Finishes seller onboarding for the signed-in (verified Google) account: saves the profile and grants the seller role. */
export const POST = (req: Request) => handle(async () => {
  const user = requireUser(await auth());
  if (!limits.onboardingLimiter.hit(user.email.trim().toLowerCase())) throw new ApiError(429, 'Too many requests.');
  if (!limits.ipOnboardingLimiter.hit(clientIp(req.headers))) throw new ApiError(429, 'Too many requests.');
  const checked = validateOnboarding(await readJson(req));
  if (!checked.ok) return json({ errors: checked.errors }, 422);
  // With uploads configured, the logo must be a file our own upload route handed out, not an arbitrary link.
  const cfg = storageConfig();
  if (cfg && !checked.value.logoUrl.startsWith(`${cfg.publicBase}/`)) return json({ errors: { logoUrl: 'Upload your logo.' } }, 422);
  const result = await completeOnboarding(user.email, checked.value);
  revalidatePath('/', 'layout');
  return json({ status: result.status }, 200, { 'cache-control': 'no-store' });
});

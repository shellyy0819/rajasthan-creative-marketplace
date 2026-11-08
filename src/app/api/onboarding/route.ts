import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { clientIp } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { requireUser } from '@/lib/authz';
import * as limits from '@/lib/engagement-limits';
import { ApiError } from '@/lib/errors';
import { completeOnboarding } from '@/lib/onboarding';
import { validateOnboarding } from '@/lib/onboarding-validate';
import { ensureUser } from '@/db/people';
import { getDb } from '@/db/client';
import { isOwnLogoUrl, storageConfig } from '@/lib/storage';
export const dynamic = 'force-dynamic';

/** Finishes seller onboarding for the signed-in (verified Google) account: saves the profile and grants the seller role. */
export const POST = (req: Request) => handle(async () => {
  const user = requireUser(await auth());
  if (!limits.onboardingLimiter.hit(user.email.trim().toLowerCase())) throw new ApiError(429, 'Too many requests.');
  if (!limits.ipOnboardingLimiter.hit(clientIp(req.headers))) throw new ApiError(429, 'Too many requests.');
  const checked = validateOnboarding(await readJson(req));
  if (!checked.ok) return json({ errors: checked.errors }, 422);
  // With uploads configured, the logo must be a file our own logo upload route handed out for this account, not an arbitrary link.
  const cfg = storageConfig();
  // Without uploads configured, only a non-production build accepts a plain link: in production an arbitrary URL would be rendered as an image for admins.
  if (!cfg && process.env.NODE_ENV === 'production') return json({ errors: { logoUrl: 'Upload your logo.' } }, 422);
  if (cfg) {
    const me = await ensureUser(getDb(), user.email);
    if (!isOwnLogoUrl(cfg, me.id, checked.value.logoUrl)) return json({ errors: { logoUrl: 'Upload your logo.' } }, 422);
  }
  let result;
  try { result = await completeOnboarding(user.email, checked.value); }
  catch (e) {
    // A fixable problem tied to one field (a rejected new category name, expired city pick) is a field error like any other.
    if (e instanceof ApiError && e.status === 400 && e.field) return json({ errors: { [e.field]: e.message } }, 422);
    throw e;
  }
  revalidatePath('/', 'layout');
  return json({ status: result.status }, 200, { 'cache-control': 'no-store' });
});

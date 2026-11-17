import { auth } from '@/auth';
import { clientIp } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import * as limits from '@/lib/engagement-limits';
import { sendProductEnquiry } from '@/lib/product-enquiry';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/**
 * A signed-in buyer has Craftofy email a product's maker. Visitors who are not signed in send their own email from their own mail app
 * (the form builds a mailto link), so this route never mails on behalf of an unverified address.
 */
export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  const { id } = await params;
  if (!/^p\d+$/.test(id)) throw new ApiError(404, 'Product not found.');
  let signedInEmail: string | undefined;
  try { const s = await auth(); if (s?.user?.email && s.user.active !== false) signedInEmail = s.user.email; } catch { /* a broken session is just a visitor */ }
  if (!signedInEmail) throw new ApiError(401, 'Sign in to have Craftofy send this email for you.');
  if (!limits.enquiryLimiter.hit(signedInEmail.toLowerCase())) throw new ApiError(429, 'Too many emails sent. Please try again later.');
  const body = await readJson(req);
  if (!limits.enquiryPairLimiter.hit(`${signedInEmail.toLowerCase()}|${id}`)) throw new ApiError(429, 'You already emailed this maker about this product. Please wait for their reply.');
  return json(await sendProductEnquiry(id, body, { signedInEmail }), 201, { 'cache-control': 'no-store' });
});

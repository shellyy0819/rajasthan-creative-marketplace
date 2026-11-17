import { auth } from '@/auth';
import { clientIp } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import * as limits from '@/lib/engagement-limits';
import { sendProductEnquiry } from '@/lib/product-enquiry';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** A buyer emails a product's maker. Open to visitors who are not signed in: their typed address is marked unverified in the mail, and anonymous mail has extra caps. */
export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  const { id } = await params;
  if (!/^p\d+$/.test(id)) throw new ApiError(404, 'Product not found.');
  const body = await readJson(req);
  let signedInEmail: string | undefined;
  try { const s = await auth(); if (s?.user?.email && s.user.active !== false) signedInEmail = s.user.email; } catch { /* a broken session is just an anonymous buyer */ }
  // Signed-in buyers are limited per account (it cannot be forged); visitors per network address. Separate key spaces, so neither can use up the other's.
  if (!limits.enquiryLimiter.hit(signedInEmail ? `acct:${signedInEmail.toLowerCase()}` : `ip:${clientIp(req.headers)}`)) throw new ApiError(429, 'Too many emails sent. Please try again later.');
  const typed = body && typeof body === 'object' && !Array.isArray(body) ? String((body as Record<string, unknown>).email ?? '').trim().toLowerCase() : '';
  if (!limits.enquiryPairLimiter.hit(`${signedInEmail ? 'acct' : 'anon'}:${(signedInEmail ?? typed).toLowerCase()}|${id}`)) throw new ApiError(429, 'You already emailed this maker about this product. Please wait for their reply.');
  // The client address and the typed email are sender-controlled (X-Forwarded-For can be forged, an address can be varied), so anonymous
  // mail is also capped per product. It is counted only when the mail is about to be sent, never for invalid or bot requests.
  // Signed-in buyers are keyed on their account, which cannot be forged.
  const beforeSend = () => {
    if (signedInEmail) return;
    // Check both before spending either, so a refusal by one never uses up the other's quota.
    if (!limits.enquiryProductLimiter.check(id)) throw new ApiError(429, 'This maker has received many emails today. Please sign in to send yours, or try again later.');
    if (!limits.enquiryAnonLimiter.check('all')) throw new ApiError(429, 'Many emails are being sent right now. Please sign in to send yours, or try again later.');
    limits.enquiryProductLimiter.hit(id); limits.enquiryAnonLimiter.hit('all');
  };
  return json(await sendProductEnquiry(id, body, { ...(signedInEmail ? { signedInEmail } : {}), beforeSend }), 201, { 'cache-control': 'no-store' });
});

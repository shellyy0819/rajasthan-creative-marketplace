import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, toProduct } from '../db/mappers';
import { products } from '../db/schema';
import { productSlug } from './catalog';
import { ApiError } from './errors';
import { mailConfigured, sendMail } from './mailer';
import { resolveMailConfig } from './settings';
import { abs } from './site';
import { EMAIL_RE } from './validate';

const oneLine = (v: string) => v.replace(/[\r\n]+/g, ' ').trim();
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** What the buyer is shown after sending: the mail exactly as the seller received it. */
export type SentEnquiry = { seller: string; to: string; from: string; replyTo: string; subject: string; text: string };

/**
 * A buyer's email to the maker of a product. It goes only to the seller's public address (never one the buyer supplies), from Craftofy's sender,
 * with Reply set to the buyer. `beforeSend` runs once the request is valid and the mail is about to be sent (it may throw to refuse). `signedInEmail` (from the session) overrides the typed address, which is otherwise unverified and says so in the mail.
 */
export async function sendProductEnquiry(productId: string, raw: unknown, opts: { signedInEmail?: string; beforeSend?: () => void } = {}): Promise<SentEnquiry> {
  const b = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const name = oneLine(str(b.name));
  const email = opts.signedInEmail ?? str(b.email);
  const message = str(b.message);
  if (!name || name.length > 100) throw new ApiError(400, 'Enter your name (100 characters or fewer).', 'name');
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) throw new ApiError(400, 'Enter a valid email address.', 'email');
  if (!message || message.length > 1000) throw new ApiError(400, 'Write a message (1000 characters or fewer).', 'message');

  // A visitor's address is unverified, so their text cannot carry links: a Craftofy-sent mail with a stranger's link is a phishing vehicle.
  if (!opts.signedInEmail && /https?:\/\/|www\.|[a-z0-9-]+\.(com|in|co|net|org|io|me|link|ly)\b/i.test(`${message} ${name}`)) throw new ApiError(400, 'Links are not allowed in a message from a visitor. Remove the link, or sign in to include it.', 'message');

  const [row] = await productsQuery(getDb()).where(and(eq(products.id, productId), eq(products.status, 'APPROVED')));
  const p = row && toProduct(row);
  if (!p) throw new ApiError(404, 'Product not found.');
  if (!p.email) throw new ApiError(409, 'This artist has not shared an email address.');

  const subject = oneLine(`Enquiry about ${p.name} on Craftofy`);
  const text = [
    message, '', '--',
    `Buyer: ${name} <${email}>`,
    opts.signedInEmail ? 'The buyer was signed in to Craftofy with this email address.' : 'The buyer typed this email address in: it is not verified.',
    `Product: ${abs(`/products/${productSlug(p)}`)}`,
    'Sent through Craftofy. Reply to this email to answer the buyer.',
  ].join('\n');
  const sent: SentEnquiry = { seller: p.seller, to: p.email, from: 'Craftofy', replyTo: email, subject, text };

  if (str(b.companyWebsite)) return sent; // hidden field only bots fill: pretend it went out
  if (!(await mailConfigured())) throw new ApiError(503, 'Email is not available right now.');
  opts.beforeSend?.(); // quotas are spent only by mail that is really about to go out, so junk requests cannot use them up
  try { await sendMail({ to: p.email, subject, text, replyTo: email }); }
  catch (e) { console.error('could not send product enquiry', productId, (e as Error)?.message ?? 'error'); throw new ApiError(502, 'We could not send your email. Please try again.'); }
  sent.from = (await resolveMailConfig().catch(() => null))?.from ?? 'Craftofy'; // the address the mail really came from
  return sent;
}

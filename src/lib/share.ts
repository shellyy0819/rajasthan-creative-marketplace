/** Where a share goes. `sms` is Messages, `copy_link` is Copy, `native` is the phone's own share sheet (where Instagram and every other app live). */
export type ShareChannel = 'whatsapp' | 'sms' | 'email' | 'instagram' | 'facebook' | 'copy_link' | 'native';
export type ShareKind = 'product' | 'workshop' | 'artist' | 'category';

const TRACKED: readonly ShareChannel[] = ['whatsapp', 'sms', 'email', 'instagram', 'facebook', 'native'];

/**
 * The address that is shared: the origin of the page it is shared from (so any domain or subdomain shares its own address) plus the page's path.
 * Filters, the city and any utm values from this visit are dropped. WhatsApp, Instagram, Facebook and the phone's share sheet add
 * utm_source=<channel>&utm_medium=share so visits that come from shares can be told apart; Copy adds nothing, because we cannot know where it is pasted.
 */
export function shareUrl(origin: string, path: string, channel?: ShareChannel): string {
  let base: URL;
  try { base = new URL(origin); } catch { throw new Error('The origin to share from is not an address.'); }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') throw new Error('Only http and https pages can be shared.');
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('The path to share must be an address on this site.');
  const clean = path.split(/[?#]/)[0];
  const url = new URL(clean, base.origin);
  if (channel && TRACKED.includes(channel)) { url.searchParams.set('utm_source', channel); url.searchParams.set('utm_medium', 'share'); }
  return url.toString();
}

/** The line written before the link. Never says "handmade": only the product page decides whether that word is true. */
export function shareMessage(kind: ShareKind, title: string, by?: string): string {
  switch (kind) {
    case 'product': return `Take a look at ${title}${by ? ` by ${by}` : ''} on Craftofy:`;
    case 'workshop': return `Take a look at ${title}${by ? ` with ${by}` : ''} on Craftofy:`;
    case 'artist': return `Meet ${title} on Craftofy:`;
    case 'category': return `Browse ${title} on Craftofy:`;
  }
}

const TITLES: Record<ShareKind, string> = { product: 'Share this find', workshop: 'Share this workshop', artist: 'Share this maker', category: 'Share this category' };
export const shareTitle = (kind: ShareKind): string => TITLES[kind];

export const whatsappUrl = (message: string, url: string): string => `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`;
/** A text message with the message and link filled in. `sms:?&body=` is the form both iPhone and Android accept. */
export const smsUrl = (message: string, url: string): string => `sms:?&body=${encodeURIComponent(`${message} ${url}`)}`;
/** An email draft: the product as the subject, the message and link in the body. */
export const mailtoUrl = (subject: string, message: string, url: string): string => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${message}\n\n${url}`)}`;
export const facebookUrl = (url: string): string => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
/** Instagram has no web share address. The message is copied, then this opens Instagram so it can be pasted into a chat or story. */
export const INSTAGRAM_URL = 'https://www.instagram.com/';

import { gaEvent } from './analytics';

export type GaContactMethod = 'whatsapp' | 'call' | 'email' | 'instagram' | 'youtube' | 'copy';
const METHOD_EVENT: Partial<Record<GaContactMethod, string>> = { whatsapp: 'contact_whatsapp', call: 'contact_call', email: 'contact_email' };

/** The public seller handle (artist slug) is the `seller_id`: internal user ids never leave the server.
 *  GA4: one `contact_seller` for any contact action, plus the method's own event when it has one. Call only on a real contact action, never on opening the sheet. */
export function gaContactSeller(p: { sellerSlug: string; method: GaContactMethod; productId?: string }): void {
  const params = { seller_id: p.sellerSlug, contact_method: p.method, ...(p.productId ? { product_id: p.productId } : {}) };
  gaEvent('contact_seller', params);
  const specific = METHOD_EVENT[p.method];
  if (specific) gaEvent(specific, params);
}

/** GA4: a seller profile page was rendered, whatever the URL parameters. */
export function gaViewSellerProfile(sellerSlug: string): void {
  gaEvent('view_seller_profile', { seller_id: sellerSlug });
}

/** GA4: call only after the server confirmed the account was created. */
export function gaSignUp(method: string): void {
  gaEvent('sign_up', { method });
}

/** GA4: call only after the server confirmed the listing was created. */
export function gaListingSubmit(listingId: string, category: string): void {
  gaEvent('listing_submit', { listing_id: listingId, category });
}

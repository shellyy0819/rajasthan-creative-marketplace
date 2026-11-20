import { gaEvent } from './analytics';

export type GaContactMethod = 'whatsapp' | 'call' | 'email' | 'instagram' | 'youtube' | 'copy';
const METHOD_EVENT: Partial<Record<GaContactMethod, string>> = {
  whatsapp: 'contact_whatsapp', call: 'contact_call', email: 'contact_email', instagram: 'contact_instagram', youtube: 'contact_youtube',
};

/** The public seller handle (artist slug) is the `seller_id`: internal user ids never leave the server.
 *  GA4: one `contact_seller` for any contact action, plus the method's own event (WhatsApp, call, email, Instagram, YouTube; "copy" has none). Call only on a real contact action, never on opening the sheet. */
export function gaContactSeller(p: { sellerSlug: string; method: GaContactMethod; productId?: string; category?: string }): void {
  // `item_category` (the product's category) lets GA4 show which categories bring contacts; it is only known when the contact is about a product.
  const params = { seller_id: p.sellerSlug, contact_method: p.method, ...(p.productId ? { product_id: p.productId } : {}), ...(p.productId && p.category ? { item_category: p.category } : {}) };
  gaEvent('contact_seller', params);
  const specific = METHOD_EVENT[p.method];
  if (specific) gaEvent(specific, params);
}

/**
 * GA4 funnel steps for the two contact methods that open a dialog first (Email, Instagram), so drop-off between the steps can be seen:
 * `contact_<method>_modal_open` when the dialog opens, `contact_<method>_button_click` when the buyer presses its main button
 * (Send email / Copy message & open Instagram). The real contact action is still `gaContactSeller` (contact_seller + contact_<method>).
 */
export function gaContactStep(p: { sellerSlug: string; method: 'email' | 'instagram'; step: 'modal_open' | 'button_click'; productId: string }): void {
  gaEvent(`contact_${p.method}_${p.step}`, { seller_id: p.sellerSlug, contact_method: p.method, product_id: p.productId });
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

/** GA4: a link to a category page was clicked, from the home block (`home`) or the all-categories list (`index`). */
export function gaCategoryClick(categorySlug: string, source: 'home' | 'index'): void {
  gaEvent('category_click', { category_slug: categorySlug, source });
}

/** GA4: a category page was shown (once per page of the list). The denominator for `select_item`. */
export function gaViewCategoryList(categorySlug: string, page: number): void {
  gaEvent('view_item_list', { item_list_id: categorySlug, item_list_name: categorySlug, page });
}

/** GA4: a product was opened from a category page's list. */
export function gaSelectItem(itemId: string, categorySlug: string): void {
  gaEvent('select_item', { item_id: itemId, item_list_id: categorySlug, item_list_name: categorySlug });
}

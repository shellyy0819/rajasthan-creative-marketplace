import { gaEvent } from './analytics';

export type GaContactMethod = 'whatsapp' | 'call' | 'email' | 'instagram' | 'youtube' | 'website' | 'copy';
const METHOD_EVENT: Partial<Record<GaContactMethod, string>> = {
  whatsapp: 'contact_whatsapp', call: 'contact_call', email: 'contact_email', instagram: 'contact_instagram', youtube: 'contact_youtube', website: 'contact_website',
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

/** GA4: a page was shared. `method` is the channel (whatsapp, instagram, facebook, copy_link, or native for the phone's own share sheet), `content_type` the kind of page. */
export function gaShare(p: { method: string; kind: string; itemId?: string }): void {
  gaEvent('share', { method: p.method, content_type: p.kind, ...(p.itemId ? { item_id: p.itemId } : {}) });
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

// ---- Workshops and online classes -------------------------------------------------------------------------------------------------------
// Nothing private is ever sent (no host email, phone or meeting link). `workshop_id` is the listing's public id (w12).

/** `class` for an online class, `workshop` for everything else (workshops, meetups, pop-ups, markets). */
export const gaWorkshopType = (w: { kind: string; mode: string }): 'class' | 'workshop' => (w.kind === 'class' || w.mode === 'online' ? 'class' : 'workshop');

/** Where on the page a workshop contact button sits: a list `card`, the detail `page`, or the phone's fixed bottom `bar`. */
export type WorkshopPlacement = 'card' | 'page' | 'bar';

/**
 * GA4: the workshop list was shown (first load, and again after each filter or search). `filters` holds only the ones in use: city, price_type (FREE or PAID),
 * format (in_person or online), q. `filter_change` follows when a filter other than the search text changed, and `search` when the search text did.
 */
export function gaWorkshopList(p: { filters: Record<string, string>; previous?: Record<string, string>; count: number }): void {
  const { q, ...rest } = p.filters;
  gaEvent('view_item_list', { item_list_id: 'workshops', item_list_name: 'workshops', item_count: p.count, ...rest });
  if (!p.previous) { if (q) gaEvent('search', { search_term: q, item_list_id: 'workshops' }); return; }
  const { q: before, ...restBefore } = p.previous;
  const keys = new Set([...Object.keys(rest), ...Object.keys(restBefore)]);
  if ([...keys].some(k => rest[k] !== restBefore[k])) gaEvent('filter_change', { item_list_id: 'workshops', ...rest });
  if (q && q !== before) gaEvent('search', { search_term: q, item_list_id: 'workshops' });
}

/** GA4: a workshop was opened from the list. */
export function gaSelectWorkshop(p: { workshopId: string; category?: string; contentType: 'class' | 'workshop' }): void {
  gaEvent('select_item', { item_id: p.workshopId, item_list_id: 'workshops', item_list_name: 'workshops', content_type: p.contentType, ...(p.category ? { item_category: p.category } : {}) });
}

/** GA4: the Craftofy Fair page (/fair) was opened. `fair_status` says whether the exhibition was open or closed at that moment, so visits to a closed fair can be told apart. */
export function gaViewFair(status: 'open' | 'closed'): void {
  gaEvent('view_fair', { fair_status: status });
}

/** GA4: a workshop page was shown. */
export function gaViewWorkshop(p: { workshopId: string; category?: string; contentType: 'class' | 'workshop' }): void {
  gaEvent('view_item', { item_id: p.workshopId, content_type: p.contentType, ...(p.category ? { item_category: p.category } : {}) });
}

/** GA4: a real contact action on a workshop (WhatsApp, Call, Instagram, Website): `contact_seller` plus the method's own event, like products. */
export function gaWorkshopContact(p: { workshopId: string; method: GaContactMethod; placement: WorkshopPlacement; category?: string; contentType: 'class' | 'workshop' }): void {
  const params = { workshop_id: p.workshopId, contact_method: p.method, content_type: p.contentType, placement: p.placement, ...(p.category ? { item_category: p.category } : {}) };
  gaEvent('contact_seller', params);
  const specific = METHOD_EVENT[p.method];
  if (specific) gaEvent(specific, params);
}

/** GA4: the booking funnel. `reserve_open` when Reserve spot is pressed, `reserve_complete` once the reservation is saved (seats, free or paid), `reserve_error` when it is refused. */
export function gaReserve(step: 'open' | 'complete' | 'error', p: { workshopId: string; seats?: number; free?: boolean }): void {
  gaEvent(`reserve_${step}`, { workshop_id: p.workshopId, ...(p.seats !== undefined ? { seats: p.seats } : {}), ...(p.free !== undefined ? { price_type: p.free ? 'free' : 'paid' } : {}) });
}

/** GA4: the host-a-workshop form: opened, moved on to a later step (`step` counts from 1), submitted (accepted by the server). `path` is class or event. */
export function gaHostForm(step: 'open' | 'step' | 'submit', p: { path: string; step?: number }): void {
  gaEvent(`host_form_${step}`, { form_path: p.path, ...(p.step !== undefined ? { step_number: p.step } : {}) });
}

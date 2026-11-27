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

/** GA4: a real contact action on a workshop (WhatsApp, Call, Instagram, Website): `contact_seller` plus the method's own event, like products, plus `workshop_inquiry`
 *  (the one event to mark as a key event for "a visitor enquired about a workshop"; products never send it). Never call it for merely opening a page. */
export function gaWorkshopContact(p: { workshopId: string; method: GaContactMethod; placement: WorkshopPlacement; category?: string; contentType: 'class' | 'workshop' }): void {
  const params = { workshop_id: p.workshopId, contact_method: p.method, content_type: p.contentType, placement: p.placement, ...(p.category ? { item_category: p.category } : {}) };
  gaEvent('contact_seller', params);
  const specific = METHOD_EVENT[p.method];
  if (specific) gaEvent(specific, params);
  gaEvent('workshop_inquiry', params);
}

/** GA4: the booking funnel. `reserve_open` when Reserve spot is pressed, `reserve_complete` once the reservation is saved (seats, free or paid), `reserve_error` when it is refused. */
export function gaReserve(step: 'open' | 'complete' | 'error', p: { workshopId: string; seats?: number; free?: boolean }): void {
  gaEvent(`reserve_${step}`, { workshop_id: p.workshopId, ...(p.seats !== undefined ? { seats: p.seats } : {}), ...(p.free !== undefined ? { price_type: p.free ? 'free' : 'paid' } : {}) });
}

/** GA4: the host-a-workshop form: opened, moved on to a later step (`step` counts from 1), submitted (accepted by the server). `path` is class or event. */
export function gaHostForm(step: 'open' | 'step' | 'submit', p: { path: string; step?: number }): void {
  gaEvent(`host_form_${step}`, { form_path: p.path, ...(p.step !== undefined ? { step_number: p.step } : {}) });
}

// ---- The fair (/fair) -------------------------------------------------------------------------------------------------------------------
// What visitors do inside the exhibition. Only public things are sent: the maker's artist handle, the product's page slug, the category and the price.
// The visitor's player code and its secret are never sent: that code is the key to their saved progress.

type FairMakerRef = { href?: string; category: string };
type FairItemRef = { key: string; pricePaise: number; href?: string };
const lastSegment = (href?: string) => (href ? href.split('/').filter(Boolean).pop() : undefined);
const fairMakerParams = (m?: FairMakerRef) => (m ? { item_category: m.category, ...(lastSegment(m.href) ? { seller_id: lastSegment(m.href) as string } : {}) } : {});

/** GA4: a visitor walked up to a stall and opened it. `seller_id` is the artist handle, left out for a sample maker. */
export function gaFairStallOpen(maker: FairMakerRef): void {
  gaEvent('fair_stall_open', fairMakerParams(maker));
}

/** GA4: an item was added to the fair shortlist. `item_id` is the product's page slug (the sample item's key for a sample), `value` is its price in rupees. */
export function gaFairShortlistAdd(item: FairItemRef, maker?: FairMakerRef): void {
  gaEvent('fair_shortlist_add', { item_id: lastSegment(item.href) ?? item.key, value: item.pricePaise / 100, currency: 'INR', ...fairMakerParams(maker) });
}

/** GA4: "View product" or a product name was followed from the fair, from the stall sheet or the shortlist. */
export function gaFairProductClick(item: FairItemRef, maker: FairMakerRef | undefined, placement: 'stall' | 'shortlist'): void {
  gaEvent('fair_product_click', { item_id: lastSegment(item.href) ?? item.key, placement, ...fairMakerParams(maker) });
}

/** GA4: a visitor started something to do at the fair: the balloon ride, the folk music, a tug of war game or the holy dip. */
export function gaFairActivityStart(activity: 'balloon' | 'music' | 'tug_of_war' | 'holy_dip'): void {
  gaEvent('fair_activity_start', { activity });
}

/** GA4: one of the day's three quests was finished. `quests_done` counts how many of the day's quests are now done, `all_done` is true for the last one. */
export function gaFairQuestComplete(p: { questId: string; done: number; total: number }): void {
  gaEvent('fair_quest_complete', { quest_id: p.questId, quests_done: p.done, all_done: p.done >= p.total });
}

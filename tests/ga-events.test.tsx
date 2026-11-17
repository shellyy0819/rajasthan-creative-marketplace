// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ga = vi.hoisted(() => ({ gaEvent: vi.fn() }));
vi.mock('@/lib/analytics', () => ga);

import { TrackSellerProfileView } from '@/components/TrackSellerProfileView';
import { gaContactSeller, gaContactStep, gaListingSubmit, gaSignUp } from '@/lib/ga-events';

beforeEach(() => ga.gaEvent.mockClear());

describe('GA4 business events', () => {
  it('view_seller_profile fires once per rendered profile', () => {
    const { rerender } = render(<TrackSellerProfileView sellerSlug="a-1" />);
    rerender(<TrackSellerProfileView sellerSlug="a-1" />);
    expect(ga.gaEvent).toHaveBeenCalledTimes(1);
    expect(ga.gaEvent).toHaveBeenCalledWith('view_seller_profile', { seller_id: 'a-1' });
  });
  it('contact_seller always fires; every social action also sends its own named event with the same parameters', () => {
    for (const [method, event] of [['whatsapp', 'contact_whatsapp'], ['call', 'contact_call'], ['email', 'contact_email'], ['instagram', 'contact_instagram'], ['youtube', 'contact_youtube']] as const) {
      ga.gaEvent.mockClear();
      gaContactSeller({ sellerSlug: 'a-1', method, productId: 'p1' });
      const params = { seller_id: 'a-1', contact_method: method, product_id: 'p1' };
      expect(ga.gaEvent.mock.calls).toEqual([['contact_seller', params], [event, params]]);
    }
  });
  it('copying a phone or email only sends contact_seller (it is not a separate channel)', () => {
    gaContactSeller({ sellerSlug: 'a-1', method: 'copy' });
    expect(ga.gaEvent.mock.calls).toEqual([['contact_seller', { seller_id: 'a-1', contact_method: 'copy' }]]);
  });
  it('dialog funnel steps are named per method and carry the seller and product', () => {
    ga.gaEvent.mockClear();
    gaContactStep({ sellerSlug: 'a-1', method: 'email', step: 'modal_open', productId: 'p1' });
    gaContactStep({ sellerSlug: 'a-1', method: 'email', step: 'button_click', productId: 'p1' });
    gaContactStep({ sellerSlug: 'a-1', method: 'instagram', step: 'modal_open', productId: 'p1' });
    gaContactStep({ sellerSlug: 'a-1', method: 'instagram', step: 'button_click', productId: 'p1' });
    expect(ga.gaEvent.mock.calls.map(c => c[0])).toEqual(['contact_email_modal_open', 'contact_email_button_click', 'contact_instagram_modal_open', 'contact_instagram_button_click']);
    expect(ga.gaEvent.mock.calls[0][1]).toEqual({ seller_id: 'a-1', contact_method: 'email', product_id: 'p1' });
  });
  it('sign_up and listing_submit carry their parameters', () => {
    gaSignUp('google');
    gaListingSubmit('p9', 'Handmade');
    expect(ga.gaEvent).toHaveBeenCalledWith('sign_up', { method: 'google' });
    expect(ga.gaEvent).toHaveBeenCalledWith('listing_submit', { listing_id: 'p9', category: 'Handmade' });
  });
});

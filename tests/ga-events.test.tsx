// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ga = vi.hoisted(() => ({ gaEvent: vi.fn() }));
vi.mock('@/lib/analytics', () => ga);

import { TrackSellerProfileView } from '@/components/TrackSellerProfileView';
import { gaContactSeller, gaListingSubmit, gaSignUp } from '@/lib/ga-events';

beforeEach(() => ga.gaEvent.mockClear());

describe('GA4 business events', () => {
  it('view_seller_profile fires once per rendered profile', () => {
    const { rerender } = render(<TrackSellerProfileView sellerSlug="a-1" />);
    rerender(<TrackSellerProfileView sellerSlug="a-1" />);
    expect(ga.gaEvent).toHaveBeenCalledTimes(1);
    expect(ga.gaEvent).toHaveBeenCalledWith('view_seller_profile', { seller_id: 'a-1' });
  });
  it('contact_seller always fires; whatsapp, call and email add their own event', () => {
    gaContactSeller({ sellerSlug: 'a-1', method: 'whatsapp', productId: 'p1' });
    expect(ga.gaEvent.mock.calls.map(c => c[0])).toEqual(['contact_seller', 'contact_whatsapp']);
    ga.gaEvent.mockClear();
    gaContactSeller({ sellerSlug: 'a-1', method: 'youtube' });
    expect(ga.gaEvent.mock.calls).toEqual([['contact_seller', { seller_id: 'a-1', contact_method: 'youtube' }]]);
  });
  it('sign_up and listing_submit carry their parameters', () => {
    gaSignUp('google');
    gaListingSubmit('p9', 'Handmade');
    expect(ga.gaEvent).toHaveBeenCalledWith('sign_up', { method: 'google' });
    expect(ga.gaEvent).toHaveBeenCalledWith('listing_submit', { listing_id: 'p9', category: 'Handmade' });
  });
});

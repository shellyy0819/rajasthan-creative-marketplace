'use client';
import { useEffect, useRef } from 'react';
import { gaViewSellerProfile } from '@/lib/ga-events';

/** Records one view_seller_profile per rendered artist page (strict-mode safe). Renders nothing. */
export function TrackSellerProfileView({ sellerSlug }: { sellerSlug: string }) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === sellerSlug) return;
    last.current = sellerSlug;
    gaViewSellerProfile(sellerSlug);
  }, [sellerSlug]);
  return null;
}

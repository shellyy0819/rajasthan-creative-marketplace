'use client';
import { usePathname } from 'next/navigation';
import { PageLoader } from '@/components/PageLoader';

/** Shown while a page streams in. Non-blocking, and it sits below the navbar so navigation stays usable. The home page shows nothing: its content simply appears. The shop has its own loading state (app/shop/loading.tsx) with the page's static top already in place. */
const QUIET = new Set(['/', '/shop']);
export default function Loading() {
  return QUIET.has(usePathname() ?? '') ? null : <PageLoader show blocking={false} />;
}

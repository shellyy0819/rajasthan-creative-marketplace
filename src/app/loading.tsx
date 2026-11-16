'use client';
import { usePathname } from 'next/navigation';
import { PageLoader } from '@/components/PageLoader';

/** Shown while a page streams in. Non-blocking, and it sits below the navbar so navigation stays usable. The home page and the shop show nothing: their content simply appears. */
const QUIET = new Set(['/', '/shop']);
export default function Loading() {
  return QUIET.has(usePathname() ?? '') ? null : <PageLoader show blocking={false} />;
}

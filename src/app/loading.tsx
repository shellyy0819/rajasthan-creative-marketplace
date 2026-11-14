'use client';
import { usePathname } from 'next/navigation';
import { PageLoader } from '@/components/PageLoader';

/** Shown while a page streams in. Non-blocking, and it sits below the navbar so navigation stays usable. The home page shows nothing: its sections simply appear. */
export default function Loading() {
  return usePathname() === '/' ? null : <PageLoader show blocking={false} />;
}

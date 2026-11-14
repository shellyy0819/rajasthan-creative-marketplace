'use client';
import { usePathname } from 'next/navigation';
import { HomeSkeleton } from '@/components/HomeSkeletons';
import { PageLoader } from '@/components/PageLoader';

/** Shown while a page streams in. Non-blocking, and it sits below the navbar so navigation stays usable. The home page shows section skeletons instead of the centred loader. */
export default function Loading() {
  return usePathname() === '/' ? <HomeSkeleton /> : <PageLoader show blocking={false} />;
}

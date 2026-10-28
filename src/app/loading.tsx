import { PageLoader } from '@/components/PageLoader';

/** Shown while a page streams in. Non-blocking, and it sits below the navbar so navigation stays usable. */
export default function Loading() {
  return <PageLoader show blocking={false} />;
}

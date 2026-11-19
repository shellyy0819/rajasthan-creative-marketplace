'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HOST_OPEN_EVENT, type HostOpenDetail, type HostPath } from '@/lib/host-link';

/**
 * A "host a workshop" link (footer). From another page it is a normal link to /workshops?type=… (that page needs its own data).
 * Already on /workshops it opens the form in place: nothing is fetched and the page is not re-rendered, so it opens every time.
 */
export function HostLink({ href, path, children }: { href: string; path: HostPath; children: React.ReactNode }) {
  const here = usePathname();
  return (
    <Link href={href} prefetch={false} onClick={e => {
      const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
      if (modified || here !== '/workshops') return;
      e.preventDefault();
      window.dispatchEvent(new CustomEvent<HostOpenDetail>(HOST_OPEN_EVENT, { detail: { path } }));
    }}>{children}</Link>
  );
}

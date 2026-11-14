'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const TABS = [
  { href: '/dashboard/posts', label: 'Artists’ posts' },
  { href: '/dashboard/users', label: 'Users' },
  { href: '/dashboard/listing-requests', label: 'Listing requests' },
  { href: '/dashboard/workshop-requests', label: 'Workshop requests' },
  { href: '/dashboard/fair-notes', label: 'Fair feedback' },
  { href: '/dashboard/trending', label: 'Trending' },
  { href: '/dashboard/theme', label: 'Festive themes' },
  { href: '/dashboard/settings', label: 'Settings' },
];

/** Admin dashboard tabs; the current one is highlighted and marked aria-current. A clicked tab lights up at once, before its page has loaded. */
export function AdminTabs() {
  const path = usePathname() ?? '';
  const [clicked, setClicked] = useState<string | null>(null);
  useEffect(() => { setClicked(null); }, [path]); // the page arrived: the real path takes over
  const here = clicked ?? path;
  return (
    <nav className="admin-tabs" aria-label="Dashboard sections">
      {TABS.map(t => <Link key={t.href} href={t.href} onClick={() => setClicked(t.href)} aria-current={here === t.href || here.startsWith(`${t.href}/`) ? 'page' : undefined}>{t.label}</Link>)}
    </nav>
  );
}

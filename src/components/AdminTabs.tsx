'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard/posts', label: 'Artists’ posts' },
  { href: '/dashboard/users', label: 'Users' },
  { href: '/dashboard/listing-requests', label: 'Listing requests' },
  { href: '/dashboard/workshop-requests', label: 'Workshop requests' },
  { href: '/dashboard/fair-notes', label: 'Fair feedback' },
  { href: '/dashboard/trending', label: 'Trending' },
  { href: '/dashboard/sourcing-types', label: 'Sourcing types' },
  { href: '/dashboard/theme', label: 'Festive themes' },
  { href: '/dashboard/settings', label: 'Settings' },
];

/** Admin dashboard tabs; the one for the page being viewed is highlighted and marked aria-current. */
export function AdminTabs() {
  const path = usePathname() ?? '';
  return (
    <nav className="admin-tabs" aria-label="Dashboard sections">
      {TABS.map(t => <Link key={t.href} href={t.href} aria-current={path === t.href || path.startsWith(`${t.href}/`) ? 'page' : undefined}>{t.label}</Link>)}
    </nav>
  );
}

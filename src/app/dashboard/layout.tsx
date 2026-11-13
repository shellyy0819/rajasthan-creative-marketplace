import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaffPage } from '@/lib/admin-page';

export const metadata: Metadata = { title: { absolute: 'Dashboard | Craftofy' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  return (
    <div className="admin-shell">
      {/* A seller has a single page, so the breadcrumb is their way back; the tabs are for admins only. */}
      {user.role === 'admin' && (
        <nav className="admin-tabs" aria-label="Dashboard sections">
          <Link href="/dashboard/posts">Artists’ posts</Link>
          <Link href="/dashboard/users">Users</Link>
          <Link href="/dashboard/listing-requests">Listing requests</Link>
          <Link href="/dashboard/workshop-requests">Workshop requests</Link>
          <Link href="/dashboard/fair-notes">Fair feedback</Link>
          <Link href="/dashboard/theme">Festive themes</Link>
          <Link href="/dashboard/settings">Settings</Link>
        </nav>
      )}
      {children}
    </div>
  );
}

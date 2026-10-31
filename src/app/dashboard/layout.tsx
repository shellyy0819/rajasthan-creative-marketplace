import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaffPage } from '@/lib/admin-page';

export const metadata: Metadata = { title: { absolute: 'Dashboard | Craftology' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  return (
    <div className="admin-shell">
      <nav className="admin-tabs" aria-label="Dashboard sections">
        <Link href="/dashboard/posts">{user.role === 'admin' ? 'Artists’ posts' : 'My products'}</Link>
        {user.role === 'admin' && <Link href="/dashboard/users">Users</Link>}
        {user.role === 'admin' && <Link href="/dashboard/listing-requests">Listing requests</Link>}
      </nav>
      {children}
    </div>
  );
}

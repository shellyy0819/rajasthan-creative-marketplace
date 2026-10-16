import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaffPage } from '@/lib/admin-page';

export const metadata: Metadata = { title: { absolute: 'Admin | Rang Rajasthan' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  return (
    <div className="admin-shell">
      <nav className="admin-tabs" aria-label="Admin sections">
        <Link href="/admin/posts">{user.role === 'admin' ? 'Artists’ posts' : 'My products'}</Link>
        {user.role === 'admin' && <Link href="/admin/users">Users</Link>}
      </nav>
      {children}
    </div>
  );
}

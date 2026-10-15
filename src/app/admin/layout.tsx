import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin-page';

export const metadata: Metadata = { title: { absolute: 'Admin | Rang Rajasthan' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className="admin-shell">
      <nav className="crumbs" aria-label="Admin"><Link href="/admin/posts">Artists’ posts</Link></nav>
      {children}
    </div>
  );
}

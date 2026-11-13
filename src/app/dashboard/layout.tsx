import type { Metadata } from 'next';
import { AdminTabs } from '@/components/AdminTabs';
import { requireStaffPage } from '@/lib/admin-page';

export const metadata: Metadata = { title: { absolute: 'Dashboard | Craftofy' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  return (
    <div className="admin-shell">
      {/* A seller has a single page, so the breadcrumb is their way back; the tabs are for admins only. */}
      {user.role === 'admin' && <AdminTabs />}
      {children}
    </div>
  );
}

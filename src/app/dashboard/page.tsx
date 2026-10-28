import { redirect } from 'next/navigation';
import { requireStaffPage } from '@/lib/admin-page';
export const dynamic = 'force-dynamic';
export default async function DashboardIndex() { await requireStaffPage(); redirect('/dashboard/posts'); }

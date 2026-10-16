import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-page';
export const dynamic = 'force-dynamic';
export default async function AdminIndex() { await requireAdminPage(); redirect('/admin/posts'); }

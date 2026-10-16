import { Breadcrumbs } from '@/components/Breadcrumbs';
import { UsersAdmin } from '@/components/UsersAdmin';
import { requireAdminPage } from '@/lib/admin-page';
import { listUsers } from '@/lib/users';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const session = await auth();
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Admin', path: '/admin' }, { name: 'Users', path: '/admin/users' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <UsersAdmin initialUsers={await listUsers()} currentEmail={session?.user?.email ?? ''} />
    </>
  );
}

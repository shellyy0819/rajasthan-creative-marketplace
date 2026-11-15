import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SourcingTypesAdmin } from '@/components/SourcingTypesAdmin';
import { requireAdminPage } from '@/lib/admin-page';
import { hostConfig } from '@/lib/hosts';
import { listSourcingTypesForAdmin } from '@/lib/sourcing-types';

export const dynamic = 'force-dynamic';

export default async function AdminSourcingTypesPage() {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Sourcing types', path: '/dashboard/sourcing-types' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <SourcingTypesAdmin initial={await listSourcingTypesForAdmin()} />
    </>
  );
}

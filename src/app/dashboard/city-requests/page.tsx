import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CityRequestsAdmin } from '@/components/CityRequestsAdmin';
import { requireAdminPage } from '@/lib/admin-page';
import { listCityRequests } from '@/lib/city-requests';
import { hostConfig } from '@/lib/hosts';

export const dynamic = 'force-dynamic';

export default async function CityRequestsPage() {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'City requests', path: '/dashboard/city-requests' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <CityRequestsAdmin initial={await listCityRequests()} />
    </>
  );
}

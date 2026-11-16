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
      <section className="admin-posts">
        <div className="page-head">
          <h1>City requests</h1>
          <p>Cities that sellers added because they could not find theirs in the City field. They are approved automatically, so the seller can carry on at once, and you get an email each time. Change any of them whenever you need: confirm it, rename it, remove it from the City field, or restore it.</p>
        </div>
        <CityRequestsAdmin initial={await listCityRequests()} />
      </section>
    </>
  );
}

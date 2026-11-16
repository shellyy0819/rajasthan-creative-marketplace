import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RequestsOverview } from '@/components/RequestsOverview';
import { requireAdminPage } from '@/lib/admin-page';
import { listCityRequests } from '@/lib/city-requests';
import { hostConfig } from '@/lib/hosts';
import { listListingRequests } from '@/lib/listing-requests';
import { listWorkshopRequests } from '@/lib/workshop-requests';

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Requests', path: '/dashboard/requests' }];
  const [cities, listings, workshops] = await Promise.all([listCityRequests(), listListingRequests(), listWorkshopRequests()]);
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <section className="admin-posts">
        <div className="page-head">
          <h1>Requests</h1>
          <p>Everything people have asked for, one heading for each kind, newest first. Open a kind to act on its requests.</p>
        </div>
        <RequestsOverview cities={cities} listings={listings} workshops={workshops} />
      </section>
    </>
  );
}

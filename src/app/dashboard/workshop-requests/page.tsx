import { Breadcrumbs } from '@/components/Breadcrumbs';
import { WorkshopRequestsAdmin } from '@/components/WorkshopRequestsAdmin';
import { requireAdminPage } from '@/lib/admin-page';
import { hostConfig } from '@/lib/hosts';
import { listWorkshopRequests } from '@/lib/workshop-requests';

export const dynamic = 'force-dynamic';

export default async function WorkshopRequestsPage() {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Workshop requests', path: '/dashboard/workshop-requests' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <section className="admin-posts">
        <div className="page-head">
          <h1>Workshop requests</h1>
          <p>Workshops, meetups, pop-ups and flea markets people want to host. Phone numbers are not verified. Contact the host, then create the workshop if it fits.</p>
        </div>
        <div className="admin-grid admin-grid-solo">
          <WorkshopRequestsAdmin requests={await listWorkshopRequests()} />
        </div>
      </section>
    </>
  );
}

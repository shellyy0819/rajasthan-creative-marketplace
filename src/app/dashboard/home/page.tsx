import { Breadcrumbs } from '@/components/Breadcrumbs';
import { HomeSettingsForm } from '@/components/HomeSettingsForm';
import { requireAdminPage } from '@/lib/admin-page';
import { hostConfig } from '@/lib/hosts';
import { getHomeSettings } from '@/lib/home-settings';

export const dynamic = 'force-dynamic';

export default async function HomeSettingsPage() {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Home settings', path: '/dashboard/home' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <section className="admin-posts">
        <div className="page-head">
          <h1>Home settings</h1>
          <p>Options for the home page.</p>
        </div>
        <HomeSettingsForm initial={await getHomeSettings()} />
      </section>
    </>
  );
}

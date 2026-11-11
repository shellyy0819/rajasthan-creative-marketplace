import { auth } from '@/auth';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { EmailSettingsForm } from '@/components/EmailSettingsForm';
import { requireAdminPage } from '@/lib/admin-page';
import { hostConfig } from '@/lib/hosts';
import { getEmailSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const session = await auth();
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Settings', path: '/dashboard/settings' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <section className="admin-posts">
        <div className="page-head">
          <h1>Settings</h1>
          <p>Site-wide options for administrators.</p>
        </div>
        <EmailSettingsForm initial={await getEmailSettings()} adminEmail={session?.user?.email ?? ''} />
      </section>
    </>
  );
}

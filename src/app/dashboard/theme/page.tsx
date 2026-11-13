import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ThemesAdmin } from '@/components/ThemesAdmin';
import { requireAdminPage } from '@/lib/admin-page';
import { hostConfig } from '@/lib/hosts';
import { toDto } from '@/lib/themes/dto';
import { getBase, listThemes } from '@/lib/themes/store';

export const dynamic = 'force-dynamic';

export default async function AdminThemePage() {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const now = new Date();
  const [base, rows] = await Promise.all([getBase(), listThemes()]);
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Festive themes', path: '/dashboard/theme' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <ThemesAdmin initialBase={toDto(base, now)} initialThemes={rows.map(r => toDto(r, now))} publicOrigin={hostConfig().publicOrigin ?? ''} />
    </>
  );
}

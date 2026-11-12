import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FairNotesAdmin } from '@/components/FairNotesAdmin';
import { requireAdminPage } from '@/lib/admin-page';
import { listNotes } from '@/lib/fair-notes';
import { hostConfig } from '@/lib/hosts';

export const dynamic = 'force-dynamic';

export default async function FairNotesPage() {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Fair feedback', path: '/dashboard/fair-notes' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <h1>Fair feedback</h1>
      <p className="muted">Notes visitors left at the mirror in the exhibition. Each one comes with a random visitor code, not a name, so you can tell notes apart without knowing who wrote them.</p>
      <FairNotesAdmin initial={await listNotes()} />
    </>
  );
}

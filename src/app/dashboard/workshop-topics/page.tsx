import { Breadcrumbs } from '@/components/Breadcrumbs';
import { TopicsAdmin } from '@/components/TopicsAdmin';
import { requireAdminPage } from '@/lib/admin-page';
import { hostConfig } from '@/lib/hosts';
import { listTopics } from '@/lib/topics';

export const dynamic = 'force-dynamic';

export default async function WorkshopTopicsPage() {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Workshop topics', path: '/dashboard/workshop-topics' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <section className="admin-posts">
        <div className="page-head">
          <h1>Workshop topics</h1>
          <p>What a workshop or class is about, such as Yoga or Crochet. Hosts pick one in the form. A topic that is in use is hidden, not deleted: its listings keep showing it.</p>
        </div>
        <div className="admin-grid admin-grid-solo">
          <TopicsAdmin initial={await listTopics()} />
        </div>
      </section>
    </>
  );
}

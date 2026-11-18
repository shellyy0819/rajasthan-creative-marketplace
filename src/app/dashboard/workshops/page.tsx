import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SignTextAdmin } from '@/components/SignTextAdmin';
import { WorkshopsAdmin } from '@/components/WorkshopsAdmin';
import { getSignText } from '@/lib/workshop-sign';
import { requireAdminPage } from '@/lib/admin-page';
import { listAdminWorkshops } from '@/lib/catalog';
import { hostConfig } from '@/lib/hosts';
import { listActiveTopics } from '@/lib/topics';
import { listWorkshopRequests } from '@/lib/workshop-requests';

export const dynamic = 'force-dynamic';

export default async function WorkshopsDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const sp = await searchParams;
  const from = typeof sp.from === 'string' ? sp.from : undefined;
  const [workshops, topics, requests, signText] = await Promise.all([listAdminWorkshops(), listActiveTopics(), from ? listWorkshopRequests() : Promise.resolve([]), getSignText()]);
  // A request can be turned into a listing again only while its listing is still a Draft (drafts can be duplicated; a published one cannot).
  const fromRequest = requests.find(r => r.id === from && (r.status !== 'listed' || r.listedStatus === 'DRAFT'));
  const presetStatus = sp.status === 'APPROVED' ? 'APPROVED' : undefined; // the Published choice on a request opens the form with Published preselected
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Workshops', path: '/dashboard/workshops' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <section className="admin-posts">
        <div className="page-head">
          <h1>Workshops</h1>
          <p>Every workshop, meetup, pop-up, flea market and online class. A new listing is a Draft: it is not public until you set it to Published. Archived hides it again.</p>
        </div>
        <div className="admin-grid admin-grid-solo">
          <SignTextAdmin initial={signText} />
          <WorkshopsAdmin initial={workshops} topics={topics} fromRequest={fromRequest} presetStatus={presetStatus} />
        </div>
      </section>
    </>
  );
}

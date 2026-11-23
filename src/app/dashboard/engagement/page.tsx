import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { requireAdminPage } from '@/lib/admin-page';
import { hostConfig } from '@/lib/hosts';
import { ACTIVITY_FILTERS, activityFrom, CONTACT_METHODS, ENGAGEMENT_WINDOWS, filterSellers, queryFrom, sellerEngagement, windowFrom, type ActivityFilter, type ContactMethod } from '@/lib/seller-engagement';

export const dynamic = 'force-dynamic';

const METHOD_LABEL: Record<ContactMethod, string> = { call: 'Call', whatsapp: 'WhatsApp', email: 'Email', instagram: 'Instagram', youtube: 'YouTube', website: 'Website', copy: 'Copied' };
const ACTIVITY_LABEL: Record<ActivityFilter, string> = { all: 'All sellers', visited: 'Had visitors', reached: 'Were reached out to' };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminEngagementPage({ searchParams }: Props) {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const sp = await searchParams;
  const days = windowFrom(sp.days);
  const q = queryFrom(sp.q);
  const activity = activityFrom(sp.activity);
  const r = await sellerEngagement({ days });
  const rows = filterSellers(r.rows, { q, activity });
  const filtered = q !== '' || activity !== 'all';
  const href = (d: number) => `/dashboard/engagement?${new URLSearchParams({ days: String(d), ...(q ? { q } : {}), ...(activity !== 'all' ? { activity } : {}) })}`;
  const publicOrigin = hostConfig().publicOrigin ?? ''; // the dashboard may sit on its own host; profiles live on the public one
  const crumbs = [{ name: 'Home', path: publicOrigin || '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Seller engagement', path: '/dashboard/engagement' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <section className="admin-posts">
        <div className="page-head">
          <h1>Seller engagement</h1>
          <p>How many visitors looked at each seller and reached out to them, over the last {r.days} days (since {r.firstDay}).</p>
        </div>
        <div className="admin-grid admin-grid-solo">
          <div>
            <div className="admin-row-actions" role="group" aria-label="Time window">
              {ENGAGEMENT_WINDOWS.map(d => (
                <Link key={d} href={href(d)} className={d === r.days ? 'button primary' : 'button'} aria-current={d === r.days ? 'page' : undefined}>Last {d} days</Link>
              ))}
            </div>
            <dl className="engagement-totals" aria-label={`All sellers, last ${r.days} days`}>
              <div><dt>Looked</dt><dd>{r.totals.viewers}</dd></div>
              <div><dt>Opened contact</dt><dd>{r.totals.openedContact}</dd></div>
              <div><dt>Reached out</dt><dd>{r.totals.contacted}</dd></div>
              <div><dt>Sellers reached out to</dt><dd>{r.totals.sellersContacted}<small> of {r.rows.length}</small></dd></div>
            </dl>
            <ol className="trending-rules">
              <li>Counts are <b>visitor-days</b>: a visitor is anonymous and gets a new id every day, so the same person on three days counts three times. A visitor who touches several of one seller’s listings on one day counts once for that seller.</li>
              <li><b>Reached out</b> means a call, email, Instagram, YouTube, WhatsApp or website click, or a copied number. It shows the buyer tried to make contact, not that the seller replied. Contacts made from an artist’s own page are not counted here (Google Analytics has them). Bots are ignored.</li>
            </ol>
            <form className="admin-toolbar" method="get" action="/dashboard/engagement" role="search">
              <input type="hidden" name="days" value={r.days} />
              <input type="search" name="q" defaultValue={q} placeholder="Search seller name" aria-label="Search seller name" maxLength={80} />
              <select name="activity" defaultValue={activity} aria-label="Show sellers">
                {ACTIVITY_FILTERS.map(a => <option key={a} value={a}>{ACTIVITY_LABEL[a]}</option>)}
              </select>
              <button type="submit" className="button primary">Filter</button>
              {filtered && <Link href={`/dashboard/engagement?days=${r.days}`} className="button">Clear</Link>}
            </form>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <caption className="sr-only">Visitors per seller{filtered ? `, ${rows.length} of ${r.rows.length} sellers shown` : ''}</caption>
                <thead>
                  <tr>
                    <th scope="col">Seller</th>
                    <th scope="col">Looked</th>
                    <th scope="col">Opened contact</th>
                    <th scope="col">Reached out</th>
                    <th scope="col">How</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(s => {
                    const how = CONTACT_METHODS.filter(m => s.byMethod[m] > 0).map(m => `${METHOD_LABEL[m]} ${s.byMethod[m]}`).join(' · ');
                    return (
                      <tr key={s.sellerId}>
                        <td>{s.listed ? <Link href={`${publicOrigin}/artists/${s.slug}`}>{s.name}</Link> : <>{s.name}<br /><small>No public profile yet</small></>}</td>
                        <td>{s.viewers}</td>
                        <td>{s.openedContact}</td>
                        <td><b>{s.contacted}</b></td>
                        <td><small>{how || '—'}</small></td>
                      </tr>
                    );
                  })}
                  {!rows.length && <tr><td colSpan={5}>{r.rows.length ? 'No seller matches these filters.' : 'No sellers yet.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

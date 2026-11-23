import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { requireAdminPage } from '@/lib/admin-page';
import { hostConfig } from '@/lib/hosts';
import { CONTACT_METHODS, ENGAGEMENT_WINDOWS, sellerEngagement, windowFrom, type ContactMethod } from '@/lib/seller-engagement';

export const dynamic = 'force-dynamic';

const METHOD_LABEL: Record<ContactMethod, string> = { call: 'Call', whatsapp: 'WhatsApp', email: 'Email', instagram: 'Instagram', youtube: 'YouTube', website: 'Website', copy: 'Copied' };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminEngagementPage({ searchParams }: Props) {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const days = windowFrom((await searchParams).days);
  const r = await sellerEngagement({ days });
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Seller engagement', path: '/dashboard/engagement' }];
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
                <Link key={d} href={`/dashboard/engagement?days=${d}`} className={d === r.days ? 'button primary' : 'button'} aria-current={d === r.days ? 'page' : undefined}>Last {d} days</Link>
              ))}
            </div>
            <ol className="trending-rules" style={{ marginTop: 18 }}>
              <li><b>{r.totals.viewers}</b> visitors looked at a seller’s product or workshop, <b>{r.totals.openedContact}</b> opened the contact options and <b>{r.totals.contacted}</b> reached out to <b>{r.totals.sellersContacted}</b> different sellers.</li>
              <li>Counts are <b>visitor-days</b>: a visitor is anonymous and gets a new id every day, so the same person on three days counts three times. A visitor who touches several of one seller’s listings on one day counts once for that seller.</li>
              <li><b>Reached out</b> means a call, email, Instagram, YouTube, WhatsApp or website click, or a copied number. It shows the buyer tried to make contact, not that the seller replied. Contacts made from an artist’s own page are not counted here (Google Analytics has them). Bots are ignored.</li>
            </ol>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <caption className="sr-only">Visitors per seller</caption>
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
                  {r.rows.map(s => {
                    const how = CONTACT_METHODS.filter(m => s.byMethod[m] > 0).map(m => `${METHOD_LABEL[m]} ${s.byMethod[m]}`).join(' · ');
                    return (
                      <tr key={s.sellerId}>
                        <td>{s.name}</td>
                        <td>{s.viewers}</td>
                        <td>{s.openedContact}</td>
                        <td><b>{s.contacted}</b></td>
                        <td><small>{how || '—'}</small></td>
                      </tr>
                    );
                  })}
                  {!r.rows.length && <tr><td colSpan={5}>No sellers yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

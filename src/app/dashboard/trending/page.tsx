import { Breadcrumbs } from '@/components/Breadcrumbs';
import { requireAdminPage } from '@/lib/admin-page';
import { hostConfig } from '@/lib/hosts';
import { trendingBreakdown, WEIGHTS, type BreakdownStatus } from '@/lib/trending';
import { trendingWorkshopsBreakdown, WORKSHOP_WEIGHTS, type WorkshopBreakdownStatus } from '@/lib/trending-workshops';

export const dynamic = 'force-dynamic';

const STATUS: Record<BreakdownStatus, string> = {
  shown: 'On the home row',
  'not-shown': 'Ranked, outside the top places',
  'artist-duplicate': 'Hidden: the artist has a better product',
  'below-threshold': 'Not enough interest yet',
};
const LABELS: Record<keyof typeof WEIGHTS, string> = { views: 'Viewers', contact: 'Contact clicks', artist: 'Artist clicks', likes: 'Likes' };
const KEYS = Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[];
const WS_STATUS: Record<WorkshopBreakdownStatus, string> = {
  shown: 'On the home row',
  'not-shown': 'Ranked, outside the top places',
  'host-duplicate': 'Hidden: the host has a better workshop',
  'below-threshold': 'Not enough interest yet',
};
const WS_LABELS: Record<keyof typeof WORKSHOP_WEIGHTS, string> = { views: 'Viewers', contact: 'Contact clicks', reservations: 'Reservations' };
const WS_KEYS = Object.keys(WORKSHOP_WEIGHTS) as (keyof typeof WORKSHOP_WEIGHTS)[];
const pct = (n: number) => `${Math.round(n * 100)}%`;
const num = (n: number) => n.toFixed(3);

export default async function AdminTrendingPage() {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const [b, ws] = await Promise.all([trendingBreakdown(), trendingWorkshopsBreakdown()]);
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Trending', path: '/dashboard/trending' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <section className="admin-posts">
        <div className="page-head">
          <h1>Trending</h1>
          <p>How the “Trending now” row is chosen. Only approved products are scored, using the last {b.windowDays} days.</p>
        </div>
        <div className="admin-grid admin-grid-solo">
          <div>
            <ol className="trending-rules">
              <li>A product qualifies with <b>{b.minViews}+ distinct viewers</b>, or at least <b>1 like</b> or <b>1 contact click</b>. One view alone never qualifies.</li>
              <li>Each signal is divided by the best product’s value for that signal (0 to 1), then multiplied by its weight. The four parts add up to the score (max 1.000).</li>
              <li>Ties go to more likes, then to the newer product. Each artist shows only their best product. The home row shows the top {b.homeLimit}; /trending shows up to {b.pageLimit}.</li>
            </ol>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <caption className="sr-only">Trending calculation per product</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Product</th>
                    {KEYS.map(k => <th scope="col" key={k}>{LABELS[k]}<br /><small>weight {pct(WEIGHTS[k])} · max {b.max[k]}</small></th>)}
                    <th scope="col">Score</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map(r => (
                    <tr key={r.productId}>
                      <td>{r.rank ?? '—'}</td>
                      <td>{r.name}<br /><small>{r.productId}</small></td>
                      {KEYS.map(k => <td key={k}>{r[k]}<br /><small>{b.max[k] ? `${r[k]} / ${b.max[k]} × ${WEIGHTS[k]} = ${num(r.parts[k])}` : '—'}</small></td>)}
                      <td><b>{r.rank ? num(r.score) : '—'}</b></td>
                      <td><span className={r.status === 'shown' ? 'badge published' : 'badge draft'}>{STATUS[r.status]}</span></td>
                    </tr>
                  ))}
                  {!b.rows.length && <tr><td colSpan={KEYS.length + 4}>No approved products yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <h2 id="trending-workshops-h" style={{ marginTop: 40 }}>Trending workshops</h2>
            <p className="muted">How the “Trending workshops” rows (home page and /trending) are chosen. Only published workshops and classes that have not ended are scored, using the last {ws.windowDays} days.</p>
            <ol className="trending-rules">
              <li>A workshop qualifies with <b>{ws.minViews}+ distinct viewers</b>, or at least <b>1 contact click</b> or <b>1 reservation</b>. One view alone never qualifies.</li>
              <li>The three signals are weighted the same way as for products (each divided by the best workshop’s value, then multiplied by its weight; the parts add up to a score of at most 1.000). Reservations are the saved bookings; there is no like button for workshops.</li>
              <li>Ties go to more reservations, then to the newer listing. Each host shows only their best workshop. The home row shows the top {ws.homeLimit}; /trending shows up to {ws.pageLimit}.</li>
            </ol>
            <div className="admin-table-wrap">
              <table className="admin-table" aria-labelledby="trending-workshops-h">
                <caption className="sr-only">Trending calculation per workshop</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Workshop</th>
                    {WS_KEYS.map(k => <th scope="col" key={k}>{WS_LABELS[k]}<br /><small>weight {pct(WORKSHOP_WEIGHTS[k])} · max {ws.max[k]}</small></th>)}
                    <th scope="col">Score</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ws.rows.map(r => (
                    <tr key={r.workshopId}>
                      <td>{r.rank ?? '—'}</td>
                      <td>{r.title}<br /><small>{r.workshopId}</small></td>
                      {WS_KEYS.map(k => <td key={k}>{r[k]}<br /><small>{ws.max[k] ? `${r[k]} / ${ws.max[k]} × ${WORKSHOP_WEIGHTS[k]} = ${num(r.parts[k])}` : '—'}</small></td>)}
                      <td><b>{r.rank ? num(r.score) : '—'}</b></td>
                      <td><span className={r.status === 'shown' ? 'badge published' : 'badge draft'}>{WS_STATUS[r.status]}</span></td>
                    </tr>
                  ))}
                  {!ws.rows.length && <tr><td colSpan={WS_KEYS.length + 4}>No published workshops yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

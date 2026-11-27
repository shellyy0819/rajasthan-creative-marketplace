import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { requireAdminPage } from '@/lib/admin-page';
import { listPlayers } from '@/lib/fair-players';
import { hostConfig } from '@/lib/hosts';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

export default async function FairPlayersPage({ searchParams }: Props) {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const sp = await searchParams;
  const finishedAll = sp.done === 'all';
  const players = await listPlayers({ finishedAll });
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Fair players', path: '/dashboard/fair-players' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <section className="admin-posts">
        <div className="page-head">
          <h1>Fair players</h1>
          <p>What each player code did in the exhibition. A code is random and not a name, so you can follow a journey without knowing who played. Time played is counted while the fair is open in a tab. Kept for 90 days.</p>
        </div>
        <p className="muted">
          {players.length} {players.length === 1 ? 'player' : 'players'}{finishedAll ? ' who finished all of their latest quests' : ''}.{' '}
          {finishedAll ? <Link href="/dashboard/fair-players">Show everyone</Link> : <Link href="/dashboard/fair-players?done=all">Show only players who finished all quests</Link>}
        </p>
        {!players.length ? <p className="empty">No players yet. They appear here once someone walks into the fair.</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Code</th><th>First seen</th><th>Last seen</th><th>Days</th><th>Minutes</th><th>Stalls</th><th>Shortlisted</th><th>Quests</th></tr></thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.code}>
                    <td><code>{p.code.slice(0, 3)}-{p.code.slice(3)}</code></td>
                    <td>{when(p.firstSeen)}</td>
                    <td>{when(p.lastSeen)}</td>
                    <td>{p.days}</td>
                    <td>{p.minutes}</td>
                    <td>{p.stalls}</td>
                    <td>{p.shortlisted}</td>
                    <td>{p.questsTotal ? `${p.questsDone} of ${p.questsTotal}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

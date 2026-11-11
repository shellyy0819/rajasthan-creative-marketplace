import { instagramUrl } from '@/lib/social';
import { KIND_LABEL, type WorkshopRequest } from '@/lib/workshop-requests';

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const safeWebsite = (u: string) => (/^https?:\/\//i.test(u) ? u : undefined);

function dates(r: WorkshopRequest) {
  const range = r.startDate === r.endDate ? day(r.startDate) : `${day(r.startDate)} to ${day(r.endDate)}`;
  const time = r.startTime ? ` · ${r.startTime}${r.endTime ? `–${r.endTime}` : ''}` : r.endTime ? ` · until ${r.endTime}` : '';
  return range + time;
}

/** Host-a-workshop submissions, newest first. An admin reads one and, if it fits, creates the workshop. */
export function WorkshopRequestsAdmin({ requests }: { requests: WorkshopRequest[] }) {
  if (!requests.length) return <p className="empty">No workshop requests yet.</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>Received</th><th>Event</th><th>When</th><th>Where</th><th>Seats / price</th><th>Host</th><th>Photos</th><th>Contact</th></tr></thead>
        <tbody>
          {requests.map(r => {
            const site = r.website ? safeWebsite(r.website) : undefined;
            return (
              <tr key={r.id}>
                <td>{when(r.createdAt)}</td>
                <td><b>{r.title}</b> <small className="muted">({KIND_LABEL[r.kind]})</small><br />{r.description}{r.notes && <><br /><small className="muted">Note: {r.notes}</small></>}</td>
                <td>{dates(r)}</td>
                <td>{r.venue}, {r.city}</td>
                <td>{r.seats ?? 'Open'} · {r.priceType === 'PAID' && r.pricePaise != null ? `Rs. ${r.pricePaise / 100}` : 'Free'}</td>
                <td>{r.hostName}<br />{r.instagram && <a href={instagramUrl(r.instagram)} target="_blank" rel="noreferrer">{r.instagram}</a>}{site && <> <a href={site} target="_blank" rel="noreferrer">{site.replace(/^https?:\/\//i, '')}</a></>}</td>
                <td>{r.images.length ? r.images.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer">{i ? ', ' : ''}Photo {i + 1}</a>) : '—'}</td>
                <td>{r.contactName}<br /><a href={`tel:${r.phone}`}>{r.phone}</a><br /><a href={`mailto:${r.email}`}>{r.email}</a></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

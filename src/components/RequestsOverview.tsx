import Link from 'next/link';
import type { CityRequest } from '@/lib/city-requests';
import type { ListingRequest } from '@/lib/listing-requests';
import type { WorkshopRequest } from '@/lib/workshop-requests';

/** How many of each kind are listed here; the rest are behind the link to that kind's own page. */
export const PREVIEW = 15;
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const CITY_LABEL = { live: 'Auto-approved', approved: 'Confirmed', removed: 'Removed' } as const;
const CITY_PILL = { live: 'received', approved: 'confirmed', removed: 'removed' } as const;

function Block<T extends { id: string }>({ title, items, href, manage, empty, line }: { title: string; items: T[]; href: string; manage: string; empty: string; line: (r: T) => React.ReactNode }) {
  const shown = items.slice(0, PREVIEW);
  return (
    <section className="requests-block" aria-labelledby={`req-${href.split('/').pop()}`}>
      <h2 id={`req-${href.split('/').pop()}`}>{title} <span className="requests-count">{items.length}</span></h2>
      {items.length === 0 ? <p className="form-note">{empty}</p> : (
        <ol className="requests-list">{shown.map(r => <li key={r.id}>{line(r)}</li>)}</ol>
      )}
      {items.length > shown.length && <p className="form-note">and {items.length - shown.length} more.</p>}
      <p><Link className="text-link" href={href}>{manage} →</Link></p>
    </section>
  );
}

/** Every kind of request people have sent, one heading per kind with the requests numbered under it, newest first. Acting on one happens on that kind's own page. */
export function RequestsOverview({ cities, listings, workshops }: { cities: CityRequest[]; listings: ListingRequest[]; workshops: WorkshopRequest[] }) {
  return (
    <div className="requests-overview">
      <Block title="New city" items={cities} href="/dashboard/city-requests" manage="Manage city requests" empty="No new city requests."
        line={r => <><b>{r.name}</b>{r.state ? `, ${r.state}` : ''} <span className="muted">· added by {r.requestedByName || r.requestedBy} · {day(r.createdAt)}</span> <span className={`status-pill ${CITY_PILL[r.status]}`}>{CITY_LABEL[r.status]}</span></>} />
      <Block title="Listing requests" items={listings} href="/dashboard/listing-requests" manage="Manage listing requests" empty="No listing requests."
        line={r => <><b>{r.businessName}</b> <span className="muted">· {r.ownerName} · {day(r.createdAt)}</span> <span className={`status-pill ${r.status === 'confirmed' ? 'confirmed' : 'received'}`}>{r.status === 'confirmed' ? 'Confirmed' : 'Received'}</span></>} />
      <Block title="Workshop requests" items={workshops} href="/dashboard/workshop-requests" manage="Manage workshop requests" empty="No workshop requests."
        line={r => <><b>{r.title}</b> <span className="muted">· {r.hostName}, {r.city} · {day(r.startDate)}</span> <span className={`status-pill ${r.status === 'received' ? 'confirmed' : 'received'}`}>{r.status === 'received' ? 'Received' : 'Email not confirmed'}</span></>} />
    </div>
  );
}

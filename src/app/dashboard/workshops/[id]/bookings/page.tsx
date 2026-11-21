import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { requireStaffPage } from '@/lib/admin-page';
import { hostConfig } from '@/lib/hosts';
import { money } from '@/lib/money';
import { BOOKING_STATUS_LABEL, listWorkshopBookings } from '@/lib/workshop-bookings';
import '@/components/AdminTableControls.css';

export const dynamic = 'force-dynamic';

const at = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Who reserved a place in one workshop. Admins may open any workshop; a seller only their own (anything else is a 404). */
export default async function WorkshopBookingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffPage(); // never rely on the layout alone
  const { id } = await params;
  const found = await listWorkshopBookings(id, user);
  if (!found) notFound();
  const { workshop: w, bookings } = found;
  const isAdmin = user.role === 'admin';
  const home = hostConfig().publicOrigin ?? '/';
  const back = isAdmin ? `/dashboard/workshops/${w.id}` : '/dashboard/posts?tab=workshops';
  const crumbs = isAdmin
    ? [{ name: 'Home', path: home }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Workshops', path: '/dashboard/workshops' }, { name: w.title, path: back }, { name: 'Bookings', path: `${back}/bookings` }]
    : [{ name: 'Home', path: home }, { name: 'My workshops', path: back }, { name: 'Bookings', path: `/dashboard/workshops/${w.id}/bookings` }];
  const seatsReserved = bookings.reduce((n, b) => n + b.quantity, 0);
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <section className="admin-posts" aria-labelledby="bookings-h">
        <div className="page-head">
          <h1 id="bookings-h">Bookings</h1>
          <p>{w.title}: {bookings.length === 0 ? 'nobody has reserved yet' : `${bookings.length} reservation${bookings.length === 1 ? '' : 's'}, ${seatsReserved} seat${seatsReserved === 1 ? '' : 's'}`}{w.seats != null ? ` · ${w.booked} of ${w.seats} seats taken` : ''}. No payment is collected on Craftofy: paid places are settled with the host directly.</p>
          <p><Link href={back}>← {isAdmin ? 'Back to the workshop' : 'Back to My workshops'}</Link></p>
        </div>
        <div className="admin-grid admin-grid-solo"><div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Reserved on</th><th>Name</th><th>Email</th><th>Seats</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {bookings.length === 0 && <tr><td colSpan={6} className="empty">No reservations yet. They appear here as soon as someone reserves a spot.</td></tr>}
                {bookings.map(b => (
                  <tr key={b.id}>
                    <td>{at(b.createdAt)}</td>
                    <td><b>{b.attendeeName}</b></td>
                    <td>
                      <a href={`mailto:${b.email}`}>{b.email}</a>
                      {b.userEmail.toLowerCase() !== b.email.toLowerCase() && <><br /><span className="muted">Signed in as {b.userEmail}</span></>}
                    </td>
                    <td>{b.quantity}</td>
                    <td>{b.totalPaise > 0 ? money(b.totalPaise) : 'Free'}</td>
                    <td>{BOOKING_STATUS_LABEL[b.status] ?? b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div></div>
      </section>
    </>
  );
}

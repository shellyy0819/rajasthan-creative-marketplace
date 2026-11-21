'use client';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { HostWorkshopButton } from './HostWorkshopButton';
import { ListingForm } from './ListingForm';
import './AdminTableControls.css';
import { Toast, type ToastState } from './Toast';
import { workshopSlug } from '@/lib/catalog-shared';
import { describeSchedule, isCurrent } from '@/lib/workshop-listing';
import type { TopicOption } from '@/lib/topics';
import type { Workshop } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Draft', APPROVED: 'Published', ARCHIVED: 'Archived' };
const STATUS_CLASS: Record<string, string> = { DRAFT: 'archived', APPROVED: 'published', ARCHIVED: 'archived' };
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** A seller's own workshops on their dashboard: view and edit. Publishing, archiving and deleting stay with the team. */
export function SellerWorkshops({ initial, topics, contactEmail }: { initial: Workshop[]; topics: TopicOption[]; contactEmail?: string }) {
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<Workshop | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const closeToast = useCallback(() => setToast(null), []);
  const closeForm = useCallback(() => setEditing(null), []);
  const saved = (w: Workshop) => {
    setList(l => l.map(x => (x.id === w.id ? w : x)));
    setEditing(null);
    setToast({ id: Date.now() + Math.random(), kind: 'success', text: `${w.title} saved.` });
  };
  const needle = q.trim().toLowerCase();
  const shown = list.filter(w => (!status || w.status === status) && (!needle || `${w.title} ${w.host}`.toLowerCase().includes(needle)));
  return (
    <section className="admin-posts seller-workshops" aria-labelledby="my-workshops">
      <div className="page-head">
        <h1 id="my-workshops">My workshops</h1>
        <p>See and edit the workshops and classes you host. New workshops start as a Draft until our team publishes them; edits to a published workshop go live straight away.</p>
      </div>
      {/* The same single-column wrapper as My products, so both tabs have the same side margins. */}
      <div className="admin-grid admin-grid-solo"><div>
      <div className="admin-toolbar">
        <input aria-label="Search workshops" placeholder="Search workshops…" value={q} onChange={e => setQ(e.target.value)} />
        <select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="APPROVED">Published</option>
          <option value="DRAFT">Drafts</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <HostWorkshopButton className="button primary" label="Host a Workshop" contactEmail={contactEmail} topics={topics} prefill saveDraft shareable />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Title</th><th>When</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={4} className="empty">{list.length === 0 ? 'No workshops yet. Use Host a Workshop: once you confirm your email, it shows up here as a Draft that our team reviews and publishes.' : 'No workshops match those filters.'}</td></tr>}
            {shown.map(w => (
              <tr key={w.id}>
                <td><b>{w.title}</b></td>
                <td>{w.kind === 'class' && w.schedule ? describeSchedule(w.schedule) : <>{day(w.date)}{w.endsOn ? ` to ${day(w.endsOn)}` : ''}</>}</td>
                <td><span className={`badge ${STATUS_CLASS[w.status] ?? 'archived'}`}>{STATUS_LABEL[w.status] ?? w.status}</span>{w.status === 'APPROVED' && !isCurrent(w) && <> <span className="badge published">Ended</span></>}</td>
                <td>
                  <div className="admin-row-actions">
                    <button type="button" className="button" aria-label={`Edit ${w.title}`} onClick={() => setEditing(w)}>Edit</button>
                    {w.seats != null && w.kind !== 'class' && <Link className="button" href={`/dashboard/workshops/${w.id}/bookings`} aria-label={`Bookings for ${w.title}`}>Bookings ({w.booked})</Link>}
                    {w.status === 'APPROVED' && <Link className="button" href={`/workshops/${workshopSlug(w)}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${w.title} on the site`}>View</Link>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div></div>
      {editing && <ListingForm key={editing.id} topics={topics} workshop={editing} sellerMode onSaved={saved} onClose={closeForm} />}
      <Toast toast={toast} onClose={closeToast} />
    </section>
  );
}

'use client';
import Link from 'next/link';
import { useCallback, useState } from 'react';
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
export function SellerWorkshops({ initial, topics }: { initial: Workshop[]; topics: TopicOption[] }) {
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<Workshop | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeForm = useCallback(() => setEditing(null), []);
  const saved = (w: Workshop) => {
    setList(l => l.map(x => (x.id === w.id ? w : x)));
    setEditing(null);
    setToast({ id: Date.now() + Math.random(), kind: 'success', text: `${w.title} saved.` });
  };
  return (
    <section className="seller-workshops" aria-labelledby="my-workshops">
      <h2 id="my-workshops">My workshops</h2>
      {list.length === 0 ? <p className="empty">You have no workshops yet. <Link href="/workshops">Host a workshop</Link> and it will show up here once our team has listed it.</p> : <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Title</th><th>When</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {list.map(w => (
              <tr key={w.id}>
                <td><b>{w.title}</b></td>
                <td>{w.kind === 'class' && w.schedule ? describeSchedule(w.schedule) : <>{day(w.date)}{w.endsOn ? ` to ${day(w.endsOn)}` : ''}</>}</td>
                <td><span className={`badge ${STATUS_CLASS[w.status] ?? 'archived'}`}>{STATUS_LABEL[w.status] ?? w.status}</span>{w.status === 'APPROVED' && !isCurrent(w) && <> <span className="badge published">Ended</span></>}</td>
                <td>
                  <div className="admin-row-actions">
                    <button type="button" className="button" aria-label={`Edit ${w.title}`} onClick={() => setEditing(w)}>Edit</button>
                    {w.status === 'APPROVED' && <Link className="button" href={`/workshops/${workshopSlug(w)}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${w.title} on the site`}>View</Link>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
      {editing && <ListingForm key={editing.id} topics={topics} workshop={editing} sellerMode onSaved={saved} onClose={closeForm} />}
      <Toast toast={toast} onClose={closeToast} />
    </section>
  );
}

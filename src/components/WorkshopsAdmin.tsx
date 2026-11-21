'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { ListingForm } from './ListingForm';
import './AdminTableControls.css';
import { PageLoader } from './PageLoader';
import { Toast, type ToastState } from './Toast';
import { describeSchedule, isCurrent } from '@/lib/workshop-listing';
import type { TopicOption } from '@/lib/topics';
import type { Workshop } from '@/lib/types';
import type { WorkshopRequest } from '@/lib/workshop-requests';

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Draft', APPROVED: 'Published', ARCHIVED: 'Archived' };
/** When the listing was created, in India time: "18 Nov 2026, 7:35 pm". */
const created = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\bam\b|\bpm\b/i, m => m.toLowerCase());
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Yellow Recurring (a repeating class), green Ended (past its last day), grey In Draft. A listing can carry several. */
function tagsOf(w: Workshop): { label: string; cls: string }[] {
  const tags: { label: string; cls: string }[] = [];
  if (w.schedule) tags.push({ label: 'Recurring', cls: 'recurring' });
  if (!isCurrent(w)) tags.push({ label: 'Ended', cls: 'published' });
  if (w.status === 'DRAFT') tags.push({ label: 'In Draft', cls: 'archived' });
  return tags;
}

/** The preview page of a listing: the real workshop page, for a listing in any status. */
const previewHref = (w: Workshop) => `/dashboard/workshops/${w.id}`;

/**
 * Every listing, in every status. An admin adds, edits, publishes and archives listings on behalf of hosts. A click on a row opens its preview.
 * `editId` opens that listing's edit form at once (the preview page's Edit button links here).
 */
export function WorkshopsAdmin({ initial, topics, fromRequest, presetStatus, editId }: { initial: Workshop[]; topics: TopicOption[]; fromRequest?: WorkshopRequest; presetStatus?: string; editId?: string }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const editing = editId ? initial.find(x => x.id === editId) : undefined;
  const [form, setForm] = useState<{ workshop?: Workshop; request?: WorkshopRequest } | null>(fromRequest ? { request: fromRequest } : editing ? { workshop: editing } : null);
  const [busy, setBusy] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const closeToast = useCallback(() => setToast(null), []);
  const closeForm = useCallback(() => setForm(null), []);

  async function setStatus(w: Workshop, status: string) {
    if (busy) return;
    setBusy(w.id);
    try {
      const r = await fetch(`/api/workshops/${w.id}/status`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
      const data = await r.json().catch(() => null);
      if (!r.ok) notify('error', data?.error ?? 'Could not change the status.');
      else { setList(l => l.map(x => (x.id === w.id ? { ...x, ...data } : x))); notify('success', `${w.title} is now ${STATUS_LABEL[status]}.`); }
    } catch { notify('error', 'Network error. Please try again.'); }
    setBusy('');
  }

  async function remove(w: Workshop) {
    if (busy) return;
    setBusy(w.id);
    try {
      const r = await fetch(`/api/workshops/${w.id}`, { method: 'DELETE' });
      const data = await r.json().catch(() => null);
      if (!r.ok) notify('error', data?.error ?? 'Could not delete the listing.');
      else { setList(l => l.filter(x => x.id !== w.id)); notify('success', `${w.title} was deleted.`); }
    } catch { notify('error', 'Network error. Please try again.'); }
    setConfirming(null);
    setBusy('');
  }

  function saved(w: Workshop) {
    setList(l => (l.some(x => x.id === w.id) ? l.map(x => (x.id === w.id ? w : x)) : [w, ...l]));
    setForm(null);
    notify('success', `${w.title} saved as ${STATUS_LABEL[w.status] ?? w.status}.`);
  }

  return (
    <>
      <div className="admin-toolbar"><button type="button" className="button primary" onClick={() => setForm({})}>New listing</button></div>
      {list.length === 0 ? <p className="empty">No listings yet.</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Title</th><th>Host</th><th>Format</th><th>When</th><th>Starts</th><th>Created</th><th>Tags</th><th>Status and actions</th></tr></thead>
            <tbody>
              {list.map(w => (
                <tr key={w.id} className="admin-click-row" onClick={e => { if (!(e.target as HTMLElement).closest('button, a, select, input, label')) router.push(previewHref(w)); }}>
                  <td><Link className="row-title" href={previewHref(w)} aria-label={`Preview ${w.title}`}><b>{w.title}</b></Link></td>
                  <td>{w.host}</td>
                  <td>{w.mode === 'online' ? 'Online' : 'In person'}{w.topic ? ` · ${w.topic.name}` : ''}{w.mode !== 'online' && w.city ? <><br /><small className="muted">{w.city}</small></> : null}</td>
                  <td>{w.kind === 'class' && w.schedule ? describeSchedule(w.schedule) : <>{day(w.date)}{w.endsOn ? ` to ${day(w.endsOn)}` : ''}</>}</td>
                  <td>{day(w.date)}, {w.time}</td>
                  <td>{w.createdAt ? created(w.createdAt) : '—'}</td>
                  <td><div className="admin-tags">{tagsOf(w).map(t => <span key={t.label} className={`badge ${t.cls}`}>{t.label}</span>)}</div></td>
                  <td>
                    <div className="admin-row-actions">
                    <select className="admin-status-select" aria-label={`Status of ${w.title}`} value={w.status} disabled={busy === w.id} onChange={e => void setStatus(w, e.target.value)}>
                      {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button type="button" className="button" aria-label={`Edit ${w.title}`} onClick={() => setForm({ workshop: w })}>Edit</button>
                    {confirming === w.id
                      ? <><button type="button" className="button danger" disabled={busy === w.id} onClick={() => void remove(w)}>Confirm delete</button><button type="button" className="button" onClick={() => setConfirming(null)}>Keep</button></>
                      : <button type="button" className="button danger-outline" aria-label={`Delete ${w.title}`} onClick={() => setConfirming(w.id)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {form && <ListingForm key={form.workshop?.id ?? form.request?.id ?? 'new'} topics={topics} workshop={form.workshop} fromRequest={form.request} presetStatus={presetStatus} onSaved={saved} onClose={closeForm} />}
      <PageLoader show={!!busy} label="Saving…" />
      <Toast toast={toast} onClose={closeToast} />
    </>
  );
}

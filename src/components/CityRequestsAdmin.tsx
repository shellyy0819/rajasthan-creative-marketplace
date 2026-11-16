'use client';
import { useCallback, useState } from 'react';
import { PageLoader } from './PageLoader';
import { Toast, type ToastState } from './Toast';
import type { CityRequest, CityRequestStatus } from '@/lib/city-requests';

const LABEL: Record<CityRequestStatus, string> = { live: 'Auto-approved', approved: 'Confirmed', removed: 'Removed' };
const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Admin list of cities that sellers added to the City field. Each is approved automatically and live at once; the admin can confirm one, remove it from the City field, or restore a removed one, whenever needed (cities already created from it stay). */
export function CityRequestsAdmin({ initial }: { initial: CityRequest[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const unchecked = items.filter(r => r.status === 'live').length;

  async function decide(r: CityRequest, decision: 'approve' | 'remove') {
    if (busy) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/city-requests/${r.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) { notify('error', (data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.'); return; }
      setItems(list => list.map(x => (x.id === r.id ? (data as CityRequest) : x)));
      notify('success', decision === 'approve' ? (r.status === 'removed' ? `“${r.name}” is back in the City field.` : `“${r.name}” confirmed.`) : `“${r.name}” removed from the City field. Cities already created from it stay.`);
    } catch { notify('error', 'Network error. Please try again.'); }
    finally { setBusy(null); }
  }

  return (
    <section className="admin-posts">
      <Toast toast={toast} onClose={closeToast} />
      <PageLoader show={!!busy} blocking={false} label="" />
      <div className="page-head">
        <h1>City requests</h1>
        <p>Cities that sellers added because they could not find theirs in the City field. They are approved automatically, so the seller can carry on at once, and you get an email each time. Change any of them whenever you need: confirm it, remove it from the City field, or restore it.</p>
      </div>
      <p className="form-note" role="status">{unchecked ? `${unchecked} auto-approved and not yet looked at.` : 'All looked at.'}</p>
      {items.length === 0 ? <div className="empty">No requests yet.</div> : (
        <div>
          {items.map(r => (
            <article key={r.id} className="admin-row" data-testid="city-request">
              <div className="admin-row-main">
                <h3>{r.name}{r.state ? <small>, {r.state}</small> : null}</h3>
                <p>Found as {r.placeLabel} · {r.requestedByName ? `${r.requestedByName} (${r.requestedBy})` : r.requestedBy} · {when(r.createdAt)}</p>
                {r.note && <p>“{r.note}”</p>}
                <p className="admin-status-line"><span className={`badge ${r.status === 'live' ? 'draft' : r.status === 'approved' ? 'published' : 'archived'}`}>{LABEL[r.status]}</span></p>
              </div>
              <div className="admin-row-actions">
                {r.status !== 'approved' && <button type="button" className="button primary" disabled={!!busy} aria-label={`${r.status === 'removed' ? 'Restore' : 'Confirm'} ${r.name}`} onClick={() => void decide(r, 'approve')}>{r.status === 'removed' ? 'Restore' : 'Confirm'}</button>}
                {r.status !== 'removed' && <button type="button" className="button danger-outline" disabled={!!busy} aria-label={`Remove ${r.name}`} onClick={() => void decide(r, 'remove')}>Remove</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

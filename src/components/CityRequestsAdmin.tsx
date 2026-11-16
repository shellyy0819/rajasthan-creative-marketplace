'use client';
import { useCallback, useState } from 'react';
import { PageLoader } from './PageLoader';
import { Toast, type ToastState } from './Toast';
import type { CityRequest, CityRequestStatus } from '@/lib/city-requests';

const LABEL: Record<CityRequestStatus, string> = { live: 'Auto-approved', approved: 'Confirmed', removed: 'Removed' };
const PILL: Record<CityRequestStatus, string> = { live: 'received', approved: 'confirmed', removed: 'removed' };
const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Cities that sellers added to the City field. Each is approved automatically and live at once; the admin can confirm one, rename it, remove it from the City field,
 * or restore a removed one, whenever needed (cities already created from it stay, and a rename also changes their name).
 */
export function CityRequestsAdmin({ initial }: { initial: CityRequest[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const unchecked = items.filter(r => r.status === 'live').length;

  async function send(r: CityRequest, body: Record<string, unknown>): Promise<CityRequest | null> {
    if (busy) return null;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/city-requests/${r.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok) { notify('error', (data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.'); return null; }
      const updated = data as CityRequest;
      setItems(list => list.map(x => (x.id === r.id ? updated : x)));
      return updated;
    } catch { notify('error', 'Network error. Please try again.'); return null; }
    finally { setBusy(null); }
  }
  async function decide(r: CityRequest, decision: 'approve' | 'remove') {
    if (!(await send(r, { decision }))) return;
    notify('success', decision === 'approve' ? (r.status === 'removed' ? `“${r.name}” is back in the City field.` : `“${r.name}” confirmed.`) : `“${r.name}” removed from the City field. Cities already created from it stay.`);
  }
  async function saveName(r: CityRequest) {
    const name = renaming?.name.trim() ?? '';
    if (name.length < 2) { notify('error', 'Enter the name to show, at least 2 letters.'); return; }
    if (name === r.name) { setRenaming(null); return; }
    if (!(await send(r, { decision: 'rename', name }))) return;
    setRenaming(null);
    notify('success', `Renamed to “${name}”. Buyers see the new name too.`);
  }

  return (
    <>
      <Toast toast={toast} onClose={closeToast} />
      <PageLoader show={!!busy} blocking={false} label="" />
      <p className="form-note" role="status">{items.length === 0 ? '' : unchecked ? `${unchecked} auto-approved and not yet looked at.` : 'All looked at.'}</p>
      {items.length === 0 ? <p className="empty">No city requests yet.</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Added</th><th>City</th><th>Found as</th><th>Added by</th><th>Note</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id} data-testid="city-request">
                  <td>{when(r.createdAt)}</td>
                  <td>
                    {renaming?.id === r.id ? (
                      <span className="city-rename">
                        <input aria-label={`New name for ${r.name}`} value={renaming.name} maxLength={80} autoFocus
                          onChange={e => setRenaming({ id: r.id, name: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void saveName(r); } else if (e.key === 'Escape') setRenaming(null); }} />
                        <button type="button" className="button primary" disabled={!!busy} aria-label={`Save name for ${r.name}`} onClick={() => void saveName(r)}>Save</button>
                        <button type="button" className="button" onClick={() => setRenaming(null)}>Cancel</button>
                      </span>
                    ) : <><b>{r.name}</b>{r.state ? <>, {r.state}</> : null}</>}
                  </td>
                  <td>{r.placeLabel}</td>
                  <td>{r.requestedByName ? `${r.requestedByName} (${r.requestedBy})` : r.requestedBy}</td>
                  <td>{r.note ? `“${r.note}”` : '—'}</td>
                  <td><span className={`status-pill ${PILL[r.status]}`}>{LABEL[r.status]}</span></td>
                  <td className="city-actions">
                    {r.status !== 'approved' && <button type="button" className="button primary" disabled={!!busy} aria-label={`${r.status === 'removed' ? 'Restore' : 'Confirm'} ${r.name}`} onClick={() => void decide(r, 'approve')}>{r.status === 'removed' ? 'Restore' : 'Confirm'}</button>}
                    {renaming?.id !== r.id && <button type="button" className="button" disabled={!!busy} aria-label={`Rename ${r.name}`} onClick={() => setRenaming({ id: r.id, name: r.name })}>Rename</button>}
                    {r.status !== 'removed' && <button type="button" className="button danger-outline" disabled={!!busy} aria-label={`Remove ${r.name}`} onClick={() => void decide(r, 'remove')}>Remove</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

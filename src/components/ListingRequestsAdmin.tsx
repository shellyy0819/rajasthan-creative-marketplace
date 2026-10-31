'use client';
import { useCallback, useState } from 'react';
import { Toast, type ToastState } from './Toast';
import { instagramUrl } from '@/lib/social';
import type { ListingRequest } from '@/lib/listing-requests';

const SIZE_LABEL = { small: 'Small', medium: 'Medium', large: 'Large' } as const;
const safeWebsite = (u: string) => (/^https?:\/\//i.test(u) ? u : undefined);
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

/** People who asked to be listed, newest first. Confirming (after a phone call) turns their email into a seller account. */
export function ListingRequestsAdmin({ initial }: { initial: ListingRequest[] }) {
  const [requests, setRequests] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const closeToast = useCallback(() => setToast(null), []);

  async function confirm(r: ListingRequest) {
    if (busy) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/listing-requests/${r.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'confirmed' }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) notify('error', (data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.');
      else { setRequests(list => list.map(x => (x.id === r.id ? (data as ListingRequest) : x))); notify('success', `${r.email} can now sign in as a seller.`); }
    } catch { notify('error', 'Network error. Please try again.'); }
    setBusy(null);
  }

  return (
    <>
      <Toast toast={toast} onClose={closeToast} />
      {!requests.length ? <p className="empty">No listing requests yet.</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Received</th><th>Owner</th><th>Business</th><th>Size</th><th>Phone</th><th>Email</th><th>Instagram</th><th>Website</th><th>Status</th></tr></thead>
            <tbody>
              {requests.map(r => {
                const site = r.website ? safeWebsite(r.website) : undefined;
                return (
                  <tr key={r.id}>
                    <td>{when(r.createdAt)}</td>
                    <td>{r.ownerName}</td>
                    <td>{r.businessName}</td>
                    <td>{SIZE_LABEL[r.size]}</td>
                    <td><a href={`tel:${r.phone}`}>{r.phone}</a></td>
                    <td><a href={`mailto:${r.email}`}>{r.email}</a></td>
                    <td>{r.instagram ? <a href={instagramUrl(r.instagram)} target="_blank" rel="noreferrer">{r.instagram}</a> : '—'}</td>
                    <td>{site ? <a href={site} target="_blank" rel="noreferrer">{site.replace(/^https?:\/\//i, '')}</a> : r.website ? r.website : '—'}</td>
                    <td>
                      {r.status === 'confirmed'
                        ? <><span className="status-pill confirmed">Confirmed</span>{r.confirmedAt && <small className="muted"> {when(r.confirmedAt)}</small>}</>
                        : <><span className="status-pill received">Received</span>{' '}
                          <button type="button" className="button primary" aria-label={`Confirm ${r.businessName}`} disabled={!!busy} aria-busy={busy === r.id} onClick={() => confirm(r)}>Confirm</button></>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

'use client';
import { useCallback, useState } from 'react';
import { Toast, type ToastState } from './Toast';
import type { FairNote } from '@/lib/fair-notes';

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
const stars = (n: number) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—');

/** Feedback notes visitors left at the exhibition's mirror, newest first. A visitor is only a random code, never a person. */
export function FairNotesAdmin({ initial }: { initial: FairNote[] }) {
  const [notes, setNotes] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const closeToast = useCallback(() => setToast(null), []);
  const rated = notes.filter(n => n.rating > 0), average = rated.length ? rated.reduce((a, n) => a + n.rating, 0) / rated.length : 0;

  async function remove(n: FairNote) {
    if (busy !== null || !window.confirm('Delete this note? This cannot be undone.')) return;
    setBusy(n.id);
    try {
      const res = await fetch(`/api/admin/fair/notes/${n.id}`, { method: 'DELETE' });
      if (res.ok) { setNotes(list => list.filter(x => x.id !== n.id)); notify('success', 'Note deleted.'); }
      else notify('error', ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.');
    } catch { notify('error', 'Network error. Please try again.'); }
    setBusy(null);
  }

  return (
    <>
      <Toast toast={toast} onClose={closeToast} />
      {!notes.length ? <p className="empty">No notes yet. They appear here when visitors leave one at the mirror in the fair.</p> : (
        <>
          <p className="muted">{notes.length} {notes.length === 1 ? 'note' : 'notes'}{rated.length ? `, average rating ${average.toFixed(1)} out of 5 from ${rated.length}` : ''}.</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Received</th><th>Rating</th><th>Note</th><th>Stall</th><th>Visitor code</th><th>Fair showed</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {notes.map(n => (
                  <tr key={n.id}>
                    <td>{when(n.createdAt)}</td>
                    <td aria-label={n.rating ? `${n.rating} out of 5` : 'No rating'}>{stars(n.rating)}</td>
                    <td style={{ maxWidth: 420, overflowWrap: 'anywhere' }}>{n.text}</td>
                    <td>{n.stall}</td>
                    <td><code>{n.code.slice(0, 3)}-{n.code.slice(3)}</code></td>
                    <td>{n.source === 'real' ? 'Live sellers' : 'Sample makers'}</td>
                    <td><button type="button" className="button danger-outline" aria-label={`Delete note from ${n.code}`} disabled={busy !== null} aria-busy={busy === n.id} onClick={() => remove(n)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

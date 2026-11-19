'use client';
import { useCallback, useState } from 'react';
import { PageLoader } from './PageLoader';
import './AdminTableControls.css';
import { Toast, type ToastState } from './Toast';
import type { AdminTopic } from '@/lib/topics';

const HEADERS = { 'content-type': 'application/json' };

/** Admin list of workshop topics (Yoga, Crochet, ...). A topic in use is switched off, not deleted. */
export function TopicsAdmin({ initial }: { initial: AdminTopic[] }) {
  const [topics, setTopics] = useState(initial);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const closeToast = useCallback(() => setToast(null), []);

  async function reload() {
    try { const r = await fetch('/api/workshop-topics', { cache: 'no-store' }); if (r.ok) setTopics(await r.json()); } catch { notify('error', 'Could not refresh the list.'); }
  }
  async function call(key: string, url: string, method: string, body: unknown, ok: string) {
    if (busy) return;
    setBusy(key);
    try {
      const r = await fetch(url, { method, headers: HEADERS, body: JSON.stringify(body) });
      if (r.ok) { notify('success', ok); await reload(); return true; }
      notify('error', ((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.');
    } catch { notify('error', 'Network error. Please try again.'); }
    finally { setBusy(''); }
    return false;
  }

  return (
    <>
      <form className="admin-toolbar" onSubmit={async e => { e.preventDefault(); if (await call('add', '/api/workshop-topics', 'POST', { name }, `${name.trim()} added.`)) setName(''); }}>
        <input value={name} onChange={e => setName(e.target.value)} aria-label="New topic name" placeholder="New topic, e.g. Pottery" required minLength={2} maxLength={40} />
        <button type="submit" className="button primary" disabled={busy === 'add'} aria-busy={busy === 'add'}>Add topic</button>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Topic</th><th>Link name</th><th>Listings</th><th>Shown in the form</th></tr></thead>
          <tbody>
            {topics.map(t => (
              <tr key={t.id}>
                <td><b>{t.name}</b></td>
                <td><small className="muted">{t.slug}</small></td>
                <td>{t.listingCount}</td>
                <td><label className="check"><input type="checkbox" checked={t.active} disabled={busy === `a-${t.id}`} onChange={e => void call(`a-${t.id}`, `/api/workshop-topics/${t.id}`, 'PATCH', { active: e.target.checked }, `${t.name} ${e.target.checked ? 'is shown' : 'is hidden'} in the form.`)} aria-label={`Show ${t.name} in the form`} /> {t.active ? 'Shown' : 'Hidden'}</label></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PageLoader show={!!busy} label="Saving…" />
      <Toast toast={toast} onClose={closeToast} />
    </>
  );
}

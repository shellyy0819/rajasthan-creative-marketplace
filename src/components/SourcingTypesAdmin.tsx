'use client';
import { useCallback, useState } from 'react';
import { PageLoader } from './PageLoader';
import { Toast, type ToastState } from './Toast';
import type { AdminSourcingType } from '@/lib/types';

const HEADERS = { 'content-type': 'application/json' };
const NAME_HINT = '2-40 characters: letters, numbers, spaces and & - \' , . ( ) /';

/** Admin list of the ways a product can be sourced (Handmade, Curated, Resold...). Types in use are switched off, not deleted. */
export function SourcingTypesAdmin({ initial }: { initial: AdminSourcingType[] }) {
  const [types, setTypes] = useState(initial);
  const [name, setName] = useState('');
  const [handmade, setHandmade] = useState(false);
  const [badge, setBadge] = useState(true);
  const [renaming, setRenaming] = useState<{ id: number; value: string } | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const closeToast = useCallback(() => setToast(null), []);

  async function call(url: string, method: string, body?: unknown): Promise<{ error: string | null }> {
    try {
      const r = await fetch(url, { method, headers: HEADERS, body: body === undefined ? undefined : JSON.stringify(body) });
      if (r.ok) return { error: null };
      return { error: ((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.' };
    } catch { return { error: 'Network error. Please try again.' }; }
  }
  async function reload() {
    try {
      const r = await fetch('/api/admin/sourcing-types', { cache: 'no-store' });
      if (r.ok) setTypes(await r.json()); else notify('error', 'Could not refresh the list.');
    } catch { notify('error', 'Could not refresh the list.'); }
  }
  async function act(key: string, fn: () => Promise<{ error: string | null }>, ok: string): Promise<boolean> {
    if (busy) return false;
    setBusy(key);
    const res = await fn();
    if (res.error) notify('error', res.error); else { notify('success', ok); await reload(); }
    setBusy('');
    return !res.error;
  }
  const patch = (t: AdminSourcingType, body: object, ok: string) => act(`p-${t.id}`, () => call(`/api/admin/sourcing-types/${t.id}`, 'PATCH', body), ok);

  return (
    <section className="admin-posts">
      <div className="page-head">
        <h1>Sourcing types</h1>
        <p>How a product came to be listed, such as Handmade, Curated or Resold. Sellers pick one for each product. Only a type that <b>counts as handmade</b> lets the site call a product “handmade”, and <b>badge on cards</b> decides whether its cards carry a label.</p>
      </div>
      <Toast toast={toast} onClose={closeToast} />
      <PageLoader show={!!busy} label="Working…" blocking={false} />
      <div className="admin-grid admin-grid-solo">
        <div className="sourcing-list">
          <form className="admin-toolbar admin-form sourcing-new" onSubmit={e => {
            e.preventDefault();
            void act('new', () => call('/api/admin/sourcing-types', 'POST', { name, countsAsHandmade: handmade, showBadge: badge }), `${name.trim()} added.`)
              .then(ok => { if (ok) { setName(''); setHandmade(false); setBadge(true); } });
          }}>
            <p className="form-note"><b>*</b> Required</p>
            <div className="sourcing-new-row">
              <label className="sourcing-name"><span className="lbl">New type</span>
                <input id="sourcing-new-name" required value={name} onChange={e => setName(e.target.value)} maxLength={40} minLength={2} title={NAME_HINT} placeholder="For example Upcycled" />
              </label>
              <label className="theme-check"><input type="checkbox" checked={handmade} onChange={e => setHandmade(e.target.checked)} /> Counts as handmade</label>
              <label className="theme-check"><input type="checkbox" checked={badge} onChange={e => setBadge(e.target.checked)} /> Badge on cards</label>
              <button type="submit" className="button primary" disabled={busy === 'new'} aria-busy={busy === 'new'}>Add type</button>
            </div>
          </form>

          {types.map((t, i) => (
            <article key={t.id} className="admin-row sourcing-row" data-testid="sourcing-row">
              <div className="admin-row-main">
                {renaming?.id === t.id ? (
                  <form className="sourcing-rename" onSubmit={e => { e.preventDefault(); void patch(t, { name: renaming.value }, 'Renamed.').then(ok => { if (ok) setRenaming(null); }); }}>
                    <input aria-label={`New name for ${t.name}`} required value={renaming.value} onChange={e => setRenaming({ id: t.id, value: e.target.value })} maxLength={40} minLength={2} title={NAME_HINT} />
                    <button type="submit" className="button primary" disabled={!!busy}>Save</button>
                    <button type="button" className="button" onClick={() => setRenaming(null)}>Cancel</button>
                  </form>
                ) : <h3>{t.name}</h3>}
                <p className="admin-status-line">
                  <span className={`badge ${t.active ? 'published' : 'archived'}`}>{t.active ? 'On' : 'Off'}</span>
                  <span className="muted">{t.productCount} {t.productCount === 1 ? 'product' : 'products'}</span>
                </p>
                <div className="sourcing-flags">
                  <label className="theme-check"><input type="checkbox" checked={t.countsAsHandmade} disabled={!!busy} onChange={e => void patch(t, { countsAsHandmade: e.target.checked }, 'Saved.')} /> Counts as handmade</label>
                  <label className="theme-check"><input type="checkbox" checked={t.showBadge} disabled={!!busy} onChange={e => void patch(t, { showBadge: e.target.checked }, 'Saved.')} /> Badge on cards</label>
                </div>
              </div>
              {confirming === t.id ? (
                <div className="admin-confirm" role="group" aria-label={`Confirm delete ${t.name}`}>
                  <span>Delete {t.name}? This can’t be undone.</span>
                  <button type="button" className="button" onClick={() => setConfirming(null)}>Cancel</button>
                  <button type="button" className="button danger" disabled={!!busy} onClick={() => void act(`d-${t.id}`, () => call(`/api/admin/sourcing-types/${t.id}`, 'DELETE'), `${t.name} deleted.`).then(() => setConfirming(null))}>Yes, delete</button>
                </div>
              ) : (
                <div className="admin-row-actions">
                  <button type="button" className="button" aria-label={`Move ${t.name} up`} disabled={!!busy || i === 0} onClick={() => void patch(t, { move: 'up' }, 'Moved.')}>↑</button>
                  <button type="button" className="button" aria-label={`Move ${t.name} down`} disabled={!!busy || i === types.length - 1} onClick={() => void patch(t, { move: 'down' }, 'Moved.')}>↓</button>
                  <button type="button" className="button" onClick={() => setRenaming({ id: t.id, value: t.name })}>Rename</button>
                  <button type="button" className="button" disabled={!!busy} onClick={() => void patch(t, { active: !t.active }, t.active ? `${t.name} switched off.` : `${t.name} switched on.`)}>{t.active ? 'Switch off' : 'Switch on'}</button>
                  {t.productCount === 0 && <button type="button" className="button danger-outline" aria-label={`Delete ${t.name}`} onClick={() => setConfirming(t.id)}>Delete</button>}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

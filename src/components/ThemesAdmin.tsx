'use client';
import { useCallback, useState } from 'react';
import { PageLoader } from './PageLoader';
import { ThemeEditor, type EditorSave } from './ThemeEditor';
import { Toast, type ToastState } from './Toast';
import type { ThemeDto } from '@/lib/themes/dto';
import { PRESETS, type PresetKey } from '@/lib/themes/presets';

const HEADERS = { 'content-type': 'application/json' };
const STATE_BADGE: Record<ThemeDto['state'], string> = { live: 'published', scheduled: 'role', draft: 'draft', ended: 'archived', base: 'role' };
const fmt = (s: string | null) => (s ? s.replace('T', ' ') + ' IST' : '—');

export function ThemesAdmin({ initialBase, initialThemes, publicOrigin = '' }: { initialBase: ThemeDto; initialThemes: ThemeDto[]; publicOrigin?: string }) {
  const [base, setBase] = useState(initialBase);
  const [themes, setThemes] = useState(initialThemes);
  const [editing, setEditing] = useState<'base' | number | null>(null);
  const [preset, setPreset] = useState<PresetKey>('dhanteras');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const closeToast = useCallback(() => setToast(null), []);

  async function call(url: string, method: string, body?: unknown): Promise<{ error: string | null; data: unknown }> {
    try {
      const r = await fetch(url, { method, headers: HEADERS, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await r.json().catch(() => null);
      return r.ok ? { error: null, data } : { error: (data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.', data };
    } catch { return { error: 'Network error. Please try again.', data: null }; }
  }
  async function reload() {
    const r = await call('/api/admin/themes', 'GET');
    if (r.error) return notify('error', 'Could not refresh the list.');
    const d = r.data as { base: ThemeDto; themes: ThemeDto[] };
    setBase(d.base); setThemes(d.themes);
  }
  async function act(key: string, fn: () => Promise<{ error: string | null; data?: unknown }>, ok: string): Promise<{ error: string | null; data?: unknown }> {
    if (busy) return { error: 'busy' };
    setBusy(key);
    const res = await fn();
    if (res.error) notify('error', res.error); else { notify('success', ok); await reload(); }
    setBusy(null);
    return res;
  }

  const current = editing === 'base' ? base : themes.find(t => t.id === editing);
  const save = (v: EditorSave) => {
    if (!current) return;
    const isBase = editing === 'base';
    void act('save', () => (isBase ? call('/api/admin/themes/base', 'PATCH', { config: v.config }) : call(`/api/admin/themes/${current.id}`, 'PATCH', v)), `${isBase ? 'Everyday' : current.label} saved.`)
      .then(r => { if (!r.error) setEditing(null); });
  };
  async function previewOnSite(t: ThemeDto) {
    const r = await act(`pv-${t.id}`, () => call('/api/admin/themes/preview', 'POST', { id: t.id }), `Previewing ${t.label}. Open the site while signed in.`);
    if (!r.error) window.open(`${publicOrigin}/`, '_blank', 'noopener');
  }

  return (
    <section className="admin-posts">
      <div className="page-head">
        <h1>Festive themes</h1>
        <p>Choose how the whole site looks for a festival. A scheduled theme turns itself on and off at the times below (India time); with nothing live the site shows Everyday.</p>
      </div>
      <Toast toast={toast} onClose={closeToast} />
      <PageLoader show={!!busy} label="Working…" blocking={false} />

      {current && editing !== null && (
        <ThemeEditor key={String(editing)} theme={current} isBase={editing === 'base'} saving={busy === 'save'} onSave={save} onClose={() => setEditing(null)} />
      )}

      <article className="admin-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }} data-testid="theme-base">
        <div className="admin-row-main">
          <h3>Everyday</h3>
          <p>The default look, shown whenever no festival is live.</p>
          <p className="admin-status-line"><span className="badge role">Always on</span></p>
        </div>
        <div className="admin-row-actions"><button type="button" className="button" onClick={() => setEditing('base')}>Edit</button></div>
      </article>

      <form className="admin-toolbar admin-form" onSubmit={e => {
        e.preventDefault();
        void act('new', () => call('/api/admin/themes', 'POST', { preset }), `${PRESETS[preset].label} draft created.`);
      }}>
        <label style={{ flex: 1, margin: 0 }}>
          <span className="lbl">New theme from preset</span>
          <select required value={preset} onChange={e => setPreset(e.target.value as PresetKey)}>
            {(Object.keys(PRESETS) as PresetKey[]).filter(k => k !== 'everyday').map(k => <option key={k} value={k}>{PRESETS[k].label}</option>)}
          </select>
        </label>
        <button type="submit" className="button primary" disabled={busy === 'new'} aria-busy={busy === 'new'} style={{ alignSelf: 'flex-end' }}>Create draft</button>
      </form>

      {themes.length === 0 ? <div className="empty">No festival themes yet. Create a draft from a preset, set its dates, then schedule it.</div> : themes.map(t => (
        <article key={t.id} className="admin-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }} data-testid="theme-row">
          <div className="admin-row-main">
            <h3>{t.label}</h3>
            <p>{fmt(t.startsAtIst)} to {fmt(t.endsAtIst)}</p>
            <p className="admin-status-line"><span className={`badge ${STATE_BADGE[t.state]}`}>{t.state === 'live' ? 'Live now' : t.state[0].toUpperCase() + t.state.slice(1)}</span></p>
          </div>
          {confirming === t.id ? (
            <div className="admin-confirm" role="group" aria-label={`Confirm delete ${t.label}`}>
              <span>Delete this {t.label} theme? This can’t be undone.</span>
              <button type="button" className="button" onClick={() => setConfirming(null)}>Cancel</button>
              <button type="button" className="button danger" disabled={busy === `del-${t.id}`} aria-busy={busy === `del-${t.id}`}
                onClick={() => { void act(`del-${t.id}`, () => call(`/api/admin/themes/${t.id}`, 'DELETE'), 'Theme deleted.').then(() => setConfirming(null)); }}>Yes, delete</button>
            </div>
          ) : (
            <div className="admin-row-actions">
              <button type="button" className="button" aria-label={`Edit ${t.label}`} onClick={() => setEditing(t.id)}>Edit</button>
              <button type="button" className="button" aria-label={`Preview ${t.label} on the site`} onClick={() => void previewOnSite(t)}>Preview on site</button>
              {t.state === 'draft' && <button type="button" className="button primary" aria-label={`Schedule ${t.label}`} disabled={!!busy} onClick={() => void act(`sc-${t.id}`, () => call(`/api/admin/themes/${t.id}/schedule`, 'POST'), `${t.label} scheduled.`)}>Schedule</button>}
              {t.state === 'scheduled' && <button type="button" className="button" aria-label={`Unschedule ${t.label}`} disabled={!!busy} onClick={() => void act(`un-${t.id}`, () => call(`/api/admin/themes/${t.id}/schedule`, 'DELETE'), `${t.label} unscheduled.`)}>Unschedule</button>}
              {t.state === 'live' && <button type="button" className="button danger-outline" aria-label={`End ${t.label} now`} disabled={!!busy} onClick={() => void act(`end-${t.id}`, () => call(`/api/admin/themes/${t.id}/end`, 'POST'), `${t.label} ended.`)}>End now</button>}
              <button type="button" className="button danger-outline" aria-label={`Delete ${t.label}`} onClick={() => setConfirming(t.id)}>Delete</button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

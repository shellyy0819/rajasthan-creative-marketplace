'use client';
import { useCallback, useEffect, useState } from 'react';
import { PageLoader } from './PageLoader';
import { Toast, type ToastState } from './Toast';
import type { ExtraArea } from '@/lib/extra-areas-shared';
import type { Place } from '@/lib/places';

const JSON_HEADERS = { 'content-type': 'application/json' };

/**
 * Admin list of extra city areas: places such as a suburb that sellers can pick in the City field although the normal city search leaves them out.
 * Search for the area, click it, check the name sellers will see, and Add. Changes show in the City field at once.
 */
export function ExtraAreasForm({ initial }: { initial: ExtraArea[] }) {
  const [areas, setAreas] = useState(initial);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Place | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<{ key: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });

  useEffect(() => { // look the area up a moment after typing stops
    const needle = q.trim();
    if (picked || needle.length < 2) { setResults([]); setSearching(false); return; }
    let stale = false;
    const id = setTimeout(async () => {
      setSearching(true); setError('');
      try {
        const r = await fetch(`/api/admin/settings/areas/search?q=${encodeURIComponent(needle)}`, { cache: 'no-store' });
        const data = await r.json().catch(() => null);
        if (stale) return;
        if (!r.ok) { setResults([]); setError((data as { error?: string } | null)?.error ?? 'Could not search places. Please try again.'); return; }
        setResults(data as Place[]);
        if (!(data as Place[]).length) setError('No suburbs or neighbourhoods found for that. Try another spelling or a nearby name.');
      } catch { if (!stale) { setResults([]); setError('Network error. Please try again.'); } }
      finally { if (!stale) setSearching(false); }
    }, 350);
    return () => { stale = true; clearTimeout(id); };
  }, [q, picked]);

  const pick = (p: Place) => { setPicked(p); setName(p.name); setResults([]); setError(''); };
  const cancelPick = () => { setPicked(null); setName(''); setError(''); };

  async function call(method: 'POST' | 'PATCH' | 'DELETE', body: unknown): Promise<ExtraArea[] | null> {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/admin/settings/areas', { method, headers: JSON_HEADERS, body: JSON.stringify(body) });
      const data = await r.json().catch(() => null);
      if (!r.ok) { const msg = (data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.'; setError(msg); notify('error', msg); return null; }
      return (data as { areas: ExtraArea[] }).areas;
    } catch { setError('Network error. Please try again.'); notify('error', 'Network error. Please try again.'); return null; }
    finally { setBusy(false); }
  }

  async function saveName(a: ExtraArea) {
    const name = renaming?.name.trim() ?? '';
    if (name.length < 2) { notify('error', 'Enter the name sellers will see, at least 2 letters.'); return; }
    if (name === a.name) { setRenaming(null); return; }
    const next = await call('PATCH', { osmType: a.osmType, osmId: a.osmId, name });
    if (!next) return;
    setAreas(next); setRenaming(null);
    notify('success', `Renamed to “${name}”. The old name still finds it.`);
  }

  return (
    <div className="admin-grid admin-grid-solo">
      <Toast toast={toast} onClose={closeToast} />
      <PageLoader show={searching || busy} blocking={false} label="" />
      <section className="settings-card" aria-labelledby="areas-h">
        <h2 id="areas-h">Extra city areas</h2>
        <p className="settings-lead">Places such as a suburb that sellers can pick in the City field, shown by the name you choose (for example &ldquo;Hyderabad Shaikpet&rdquo;). The normal city search leaves suburbs out. A new area shows in the City field straight away.</p>
        <form className="admin-form" noValidate onSubmit={async e => {
          e.preventDefault();
          if (busy || !picked?.ref) return;
          const trimmed = name.trim();
          if (trimmed.length < 2) { setError('Enter the name sellers will see, at least 2 letters.'); return; }
          const next = await call('POST', { ref: picked.ref, name: trimmed });
          if (!next) return;
          setAreas(next); setPicked(null); setName(''); setQ('');
          notify('success', `“${trimmed}” added. Sellers can pick it in the City field now.`);
        }}>
          {error && <p role="alert" className="admin-error">{error}</p>}
          {!picked ? (
            <label><span className="lbl">Find an area</span>
              <input name="areaSearch" type="search" value={q} onChange={e => { setQ(e.target.value); setError(''); }} placeholder="Type an area, e.g. Shaikpet" autoComplete="off" maxLength={100} />
              <small>Type at least 2 letters, then click the right result.</small>
            </label>
          ) : (
            <>
              <p className="form-note">Selected: <b>{picked.label}</b> <button type="button" className="text-link" onClick={cancelPick}>Choose another</button></p>
              <label><span className="lbl">Name sellers will see</span>
                <input name="areaName" value={name} onChange={e => { setName(e.target.value); setError(''); }} maxLength={80} required />
                <small>This is the name that shows in the City field and on the site.</small>
              </label>
              {name.trim().toLowerCase() === picked.name.toLowerCase() && (
                <p className="form-note area-name-hint" role="note">Sellers will see just &ldquo;{picked.name}&rdquo;, with no city. If people know this place with its city, put the city in front, for example &ldquo;Hyderabad {picked.name}&rdquo;, so a search for the city finds it too. You can still add it as it is.</p>
              )}
              <div className="admin-actions"><button type="submit" className="button primary" disabled={busy} aria-busy={busy}>Add</button></div>
            </>
          )}
          {!picked && results.length > 0 && (
            <ul className="area-results" aria-label="Matching areas">
              {results.map(p => <li key={p.ref ?? p.label}><button type="button" className="button" onClick={() => pick(p)}>{p.label}</button></li>)}
            </ul>
          )}
        </form>
        <h3 className="area-list-h">In the City field now</h3>
        {areas.length === 0 ? <p className="form-note">No extra areas yet.</p> : (
          <ul className="area-list">
            {areas.map(a => { const key = `${a.osmType}${a.osmId}`, editing = renaming?.key === key; return (
              <li key={key}>
                {editing ? (
                  <span className="city-rename">
                    <input aria-label={`New name for ${a.name}`} value={renaming.name} maxLength={80} autoFocus onChange={e => setRenaming({ key, name: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void saveName(a); } else if (e.key === 'Escape') setRenaming(null); }} />
                    <button type="button" className="button primary" disabled={busy} aria-label={`Save name for ${a.name}`} onClick={() => void saveName(a)}>Save</button>
                    <button type="button" className="button" onClick={() => setRenaming(null)}>Cancel</button>
                  </span>
                ) : <span><b>{a.name}</b>{a.state ? <small>{a.state}</small> : null}</span>}
                {!editing && <button type="button" className="button" aria-label={`Rename ${a.name}`} disabled={busy} onClick={() => setRenaming({ key, name: a.name })}>Rename</button>}
                <button type="button" className="button danger-outline" aria-label={`Remove ${a.name}`} disabled={busy} onClick={async () => {
                  const next = await call('DELETE', { osmType: a.osmType, osmId: a.osmId });
                  if (!next) return;
                  setAreas(next);
                  notify('success', `Removed “${a.name}”. Cities already created from it stay.`);
                }}>Remove</button>
              </li>
            ); })}
          </ul>
        )}
      </section>
    </div>
  );
}

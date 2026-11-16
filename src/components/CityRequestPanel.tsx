'use client';
import { useEffect, useId, useState } from 'react';

type Found = { label: string; name: string; state?: string; ref?: string };
export type AddedCity = { label: string; name: string; state?: string; ref: string };
const JSON_HEADERS = { 'content-type': 'application/json' };

/**
 * For a seller whose city the City field did not offer: search for the place, click it, check the name that will show, and Add. The place is live at once
 * (the seller picks it straight away, and so can every other seller) and the Craftofy team is told to review it. Used inside a form, so nothing here submits.
 */
export function CityRequestPanel({ onAdded, onClose }: { onAdded: (city: AddedCity) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Found[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Found | null>(null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const uid = useId();   // this panel sits inside the City field's label, so its fields are not labels themselves

  useEffect(() => { // look the place up a moment after typing stops
    const needle = q.trim();
    if (picked || needle.length < 2) { setResults([]); setSearching(false); return; }
    let stale = false;
    const id = setTimeout(async () => {
      setSearching(true); setError('');
      try {
        const r = await fetch(`/api/places?q=${encodeURIComponent(needle)}&type=request`, { cache: 'no-store' });
        const data = await r.json().catch(() => null);
        if (stale) return;
        if (!r.ok) { setResults([]); setError((data as { error?: string } | null)?.error ?? 'Could not search places. Please try again.'); return; }
        setResults(data as Found[]);
        if (!(data as Found[]).length) setError('No place found for that. Try another spelling, or a nearby town.');
      } catch { if (!stale) { setResults([]); setError('Network error. Please try again.'); } }
      finally { if (!stale) setSearching(false); }
    }, 350);
    return () => { stale = true; clearTimeout(id); };
  }, [q, picked]);

  async function add() {
    if (busy || !picked?.ref) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Enter the name to show, at least 2 letters.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/city-requests', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ ref: picked.ref, name: trimmed, ...(note.trim() ? { note: note.trim() } : {}) }) });
      const data = await r.json().catch(() => null);
      if (!r.ok) { setError((data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.'); return; }
      onAdded((data as { place: AddedCity }).place);
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }
  // An Enter key inside this panel must not submit the form around it.
  const guard = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); if (picked) void add(); } };

  return (
    <div className="city-request" role="group" aria-label="Add a city" onKeyDown={guard}>
      <p className="form-note">Cannot find your city? Search for it here and add it. It is approved straight away, so you can use it now, and we are told.</p>
      {error && <p role="alert" className="field-error">{error}</p>}
      {!picked ? (
        <div className="field"><span className="lbl" id={`${uid}-find`}>Find the place</span>
          <input type="search" name="cityRequestSearch" aria-labelledby={`${uid}-find`} value={q} onChange={e => { setQ(e.target.value); setError(''); }} placeholder="Type a city, town or area" autoComplete="off" maxLength={100} aria-busy={searching} />
        </div>
      ) : (
        <>
          <p className="form-note">Selected: <b>{picked.label}</b> <button type="button" className="text-link" onClick={() => { setPicked(null); setName(''); setError(''); }}>Choose another</button></p>
          <div className="field"><span className="lbl" id={`${uid}-name`}>Name to show</span>
            <input name="cityRequestName" aria-labelledby={`${uid}-name`} value={name} onChange={e => { setName(e.target.value); setError(''); }} maxLength={80} />
            <small>This is how the city will appear in the City field.</small>
          </div>
          {name.trim().toLowerCase() === picked.name.toLowerCase() && (
            <p className="form-note" role="note">It will show as just &ldquo;{picked.name}&rdquo;. If buyers know the place with its city, put the city in front, for example &ldquo;Hyderabad {picked.name}&rdquo;.</p>
          )}
          <div className="field"><span className="lbl" id={`${uid}-note`}>Anything we should know? (optional)</span>
            <textarea name="cityRequestNote" aria-labelledby={`${uid}-note`} value={note} onChange={e => setNote(e.target.value)} maxLength={300} rows={2} />
          </div>
        </>
      )}
      {!picked && results.length > 0 && (
        <ul className="area-results" aria-label="Matching places">
          {results.map(p => <li key={p.ref ?? p.label}><button type="button" className="button" onClick={() => { setPicked(p); setName(p.name); setResults([]); setError(''); }}>{p.label}</button></li>)}
        </ul>
      )}
      <div className="admin-actions">
        {picked && <button type="button" className="button primary" disabled={busy} aria-busy={busy} onClick={() => void add()}>Add city</button>}
        <button type="button" className="button" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

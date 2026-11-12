'use client';
import { useCallback, useState } from 'react';
import { Toast, type ToastState } from './Toast';
import type { FairSettings } from '@/lib/fair-settings';
import type { FairSource } from '@/lib/fair-types';

const HELP: Record<FairSource, string> = {
  sample: 'The fair shows invented makers and products, clearly labelled as samples. Nothing links to a real shop.',
  real: 'The fair shows up to 8 sellers who have approved products right now, and their real products link to the product pages. Sellers with the most products come first.',
};

/** Admin switch for the exhibition (/fair): invented sample makers, or live sellers from the marketplace. */
export function FairSettingsForm({ initial }: { initial: FairSettings }) {
  const [saved, setSaved] = useState<FairSource>(initial.source);
  const [source, setSource] = useState<FairSource>(initial.source);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);

  return (
    <div className="admin-grid admin-grid-solo">
      <Toast toast={toast} onClose={closeToast} />
      <section className="settings-card" aria-labelledby="fair-h">
        <h2 id="fair-h">Exhibition</h2>
        <p className="settings-lead">The walk-around fair at /fair. Choose which makers its stalls show.</p>
        <form className="admin-form" onSubmit={async e => {
          e.preventDefault();
          if (busy) return;
          setBusy(true); setError('');
          try {
            const r = await fetch('/api/admin/settings/fair', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source }) });
            const data = await r.json().catch(() => null);
            if (!r.ok) { setError((data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.'); return; }
            setSaved((data as FairSettings).source);
            setToast({ id: Date.now() + Math.random(), kind: 'success', text: 'Exhibition settings saved.' });
          } catch { setError('Network error. Please try again.'); }
          finally { setBusy(false); }
        }}>
          <p className="form-note">Currently showing: {saved === 'real' ? 'live sellers' : 'sample makers'}. {HELP[saved]}</p>
          {error && <p role="alert" className="admin-error">{error}</p>}
          <label><span className="lbl">Makers shown in the fair</span>
            <select name="source" value={source} onChange={e => setSource(e.target.value as FairSource)}>
              <option value="sample">Sample makers (invented)</option>
              <option value="real">Live sellers from the marketplace</option>
            </select>
            <small>{HELP[source]}</small>
          </label>
          <div className="admin-actions">
            <button type="submit" className="button primary" disabled={busy} aria-busy={busy}>Save</button>
          </div>
        </form>
      </section>
    </div>
  );
}

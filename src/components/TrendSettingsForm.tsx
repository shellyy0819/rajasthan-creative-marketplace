'use client';
import { useCallback, useState } from 'react';
import { Toast, type ToastState } from './Toast';
import type { TrendSettingsView } from '@/lib/trend-settings';

/** The note under the title: what is in use right now. Never the key itself, only its last 4 characters. */
function status(v: TrendSettingsView): string {
  if (v.source === 'saved') return `Key saved, ends in ${v.keyHint}. Market research uses the settings saved here.`;
  if (v.source === 'environment') return `Using the server environment variable GEMINI_API_KEY, ends in ${v.keyHint}. Save a key here to override it.`;
  return 'No key is saved, so market research is unavailable until you add one.';
}

/** Admin settings for the market research service (Gemini): API key, model and region. A saved key is never shown again. */
export function TrendSettingsForm({ initial }: { initial: TrendSettingsView }) {
  const [view, setView] = useState(initial);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(initial.model);
  const [region, setRegion] = useState(initial.region);
  const [busy, setBusy] = useState<'save' | 'clear' | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const closeToast = useCallback(() => setToast(null), []);

  /** Shows what the server saved, so the boxes match it and the key box is empty again. */
  function adopt(v: TrendSettingsView) { setView(v); setApiKey(''); setModel(v.model); setRegion(v.region); }

  async function call(kind: 'save' | 'clear', method: string, body?: unknown) {
    if (busy) return null;
    setBusy(kind); setError('');
    try {
      const r = await fetch('/api/admin/settings/trends', { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await r.json().catch(() => null);
      if (!r.ok) { setError((data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.'); return null; }
      return data as TrendSettingsView;
    } catch { setError('Network error. Please try again.'); return null; }
    finally { setBusy(null); }
  }

  return (
    <div className="admin-grid admin-grid-solo">
      <Toast toast={toast} onClose={closeToast} />
      <section className="settings-card" aria-labelledby="trends-h">
        <h2 id="trends-h">Market trends</h2>
        <p className="settings-lead">Researches what is trending for makers with Google Gemini. Create a key in Google AI Studio and paste it here.</p>
        <form className="admin-form" onSubmit={async e => {
          e.preventDefault();
          const data = await call('save', 'PUT', { apiKey, model, region });
          if (data) { adopt(data); notify('success', 'Market trends settings saved.'); }
        }}>
          <p className="form-note">{status(view)}</p>
          {error && <p role="alert" className="admin-error">{error}</p>}
          <label><span className="lbl">Gemini API key</span>
            <input name="apiKey" type="password" required={view.source === 'none'} maxLength={300} value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={view.source === 'saved' ? 'Leave empty to keep the saved key' : view.source === 'environment' ? 'Leave empty to keep using the environment key' : 'Paste the key'} autoComplete="new-password" />
            <small>{view.source === 'environment' ? 'The environment key is in use and can be left empty. A key pasted here is stored encrypted and replaces it.' : 'Stored encrypted. It is never shown again after you save.'}</small>
          </label>
          <label><span className="lbl">Model</span>
            <input name="model" type="text" required maxLength={60} pattern="[a-z0-9.\-]{3,60}" title="Lowercase letters, numbers, dots and hyphens" value={model} onChange={e => setModel(e.target.value)} autoComplete="off" />
            <small>The Gemini model that summarises the headlines. It must support JSON output.</small>
          </label>
          <label><span className="lbl">Region</span>
            <input name="region" type="text" maxLength={200} value={region} onChange={e => setRegion(e.target.value)} autoComplete="off" />
            <small>Optional. It only steers the summary, not which news is searched. Leave empty to use the cities listed on the site.</small>
          </label>
          <div className="admin-actions">
            {view.hasStoredRow && (
              <button type="button" className="button danger-outline" disabled={!!busy} aria-busy={busy === 'clear'} onClick={async () => {
                if (!window.confirm('Remove the saved Gemini settings? Research falls back to the server environment variable, if set.')) return;
                const data = await call('clear', 'DELETE');
                if (data) { adopt(data); notify('success', 'Saved market trends settings removed.'); }
              }}>Remove saved settings</button>
            )}
            <button type="submit" className="button primary" disabled={!!busy} aria-busy={busy === 'save'}>Save</button>
          </div>
        </form>
      </section>
    </div>
  );
}

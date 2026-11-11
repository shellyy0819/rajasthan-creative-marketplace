'use client';
import { useCallback, useState } from 'react';
import { Toast, type ToastState } from './Toast';
import type { EmailSettingsView } from '@/lib/settings';

const SOURCE: Record<EmailSettingsView['source'], string> = {
  saved: 'Using the settings saved here.',
  environment: 'Using the server environment variables (RESEND_API_KEY and MAIL_FROM). Save settings here to override them.',
  none: 'Email is not set up. Visitors cannot confirm their email, so the workshop form is unavailable in production.',
};

/** Admin settings for outgoing email (Resend): sender address, API key, and a test button. The saved key is never shown again. */
export function EmailSettingsForm({ initial, adminEmail }: { initial: EmailSettingsView; adminEmail: string }) {
  const [view, setView] = useState(initial);
  const [from, setFrom] = useState(initial.from);
  const [apiKey, setApiKey] = useState('');
  const [testTo, setTestTo] = useState(adminEmail);
  const [busy, setBusy] = useState<'save' | 'test' | 'clear' | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const closeToast = useCallback(() => setToast(null), []);

  async function call(kind: 'save' | 'test' | 'clear', url: string, method: string, body?: unknown) {
    if (busy) return null;
    setBusy(kind); setError('');
    try {
      const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await r.json().catch(() => null);
      if (!r.ok) { setError((data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.'); return null; }
      return data;
    } catch { setError('Network error. Please try again.'); return null; }
    finally { setBusy(null); }
  }

  return (
    <div className="admin-grid admin-grid-solo">
      <Toast toast={toast} onClose={closeToast} />
      <section className="settings-card" aria-labelledby="email-h">
        <h2 id="email-h">Email</h2>
        <p className="settings-lead">Sends the confirmation code when someone asks to host a workshop. Uses Resend; create an API key and verify your domain there first.</p>
      <form className="admin-form" onSubmit={async e => {
        e.preventDefault();
        const data = await call('save', '/api/admin/settings/email', 'PUT', { from, apiKey });
        if (data) { setView(data as EmailSettingsView); setApiKey(''); notify('success', 'Email settings saved.'); }
      }}>
        <p className="form-note">{SOURCE[view.source]}{view.apiKeySet && view.apiKeyHint ? ` Current API key ends in ${view.apiKeyHint}.` : ''}</p>
        {error && <p role="alert" className="admin-error">{error}</p>}
        <label><span className="lbl">Send emails from</span>
          <input name="from" type="text" required maxLength={200} value={from} onChange={e => setFrom(e.target.value)} placeholder="Craftofy <hello@yourdomain.com>" autoComplete="off" />
          <small>An address on a domain you verified in Resend.</small>
        </label>
        <label><span className="lbl">Resend API key</span>
          <input name="apiKey" type="password" required={!view.apiKeySet || view.source !== 'saved'} maxLength={300} value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder={view.source === 'saved' ? 'Leave empty to keep the saved key' : 're_...'} autoComplete="new-password" />
          <small>Stored encrypted. It is never shown again after you save.</small>
        </label>
        <div className="admin-actions">
          {view.source === 'saved' && (
            <button type="button" className="button danger-outline" disabled={!!busy} aria-busy={busy === 'clear'} onClick={async () => {
              if (!window.confirm('Remove the saved email settings? Email falls back to the server environment variables, if set.')) return;
              const data = await call('clear', '/api/admin/settings/email', 'DELETE');
              if (data) { const v = data as EmailSettingsView; setView(v); setFrom(v.from); setApiKey(''); notify('success', 'Saved email settings removed.'); }
            }}>Remove saved settings</button>
          )}
          <button type="submit" className="button primary" disabled={!!busy} aria-busy={busy === 'save'}>Save</button>
        </div>
      </form>
      </section>

      <section className="settings-card" aria-labelledby="test-h">
        <h2 id="test-h">Send a test email</h2>
      <form className="admin-form" onSubmit={async e => {
        e.preventDefault();
        const data = await call('test', '/api/admin/settings/email/test', 'POST', { to: testTo });
        if (data) notify('success', `Test email sent to ${(data as { to: string }).to}.`);
      }}>
        <label><span className="lbl">Send to</span>
          <input name="to" type="email" required maxLength={254} value={testTo} onChange={e => setTestTo(e.target.value)} />
          <small>Uses the settings in use right now. Save first if you just changed them.</small>
        </label>
        <div className="admin-actions">
          <button type="submit" className="button" disabled={!!busy || view.source === 'none'} aria-busy={busy === 'test'}>Send test email</button>
        </div>
      </form>
      </section>
    </div>
  );
}

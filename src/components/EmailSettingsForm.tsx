'use client';
import { useCallback, useState } from 'react';
import { Toast, type ToastState } from './Toast';
import type { EmailSettingsView, MailProvider } from '@/lib/settings';
import { OTP_FROM } from '@/lib/site';

const SOURCE: Record<EmailSettingsView['source'], string> = {
  saved: 'Using the settings saved here.',
  environment: 'Using the server environment variables (RESEND_API_KEY and MAIL_FROM). Save settings here to override them.',
  none: 'Email is not set up. Visitors cannot confirm their email, so the workshop form is unavailable in production.',
};

/** Admin settings for outgoing email: pick Resend (API key) or SMTP (server and login), plus a test button. Saved secrets are never shown again. */
export function EmailSettingsForm({ initial, adminEmail }: { initial: EmailSettingsView; adminEmail: string }) {
  const [view, setView] = useState(initial);
  const [provider, setProvider] = useState<MailProvider>(initial.provider);
  const [from, setFrom] = useState(initial.from);
  const [apiKey, setApiKey] = useState('');
  const [otpFrom, setOtpFrom] = useState(initial.otpFrom);
  const [sFrom, setSFrom] = useState(initial.smtp.from);
  const [host, setHost] = useState(initial.smtp.host);
  const [port, setPort] = useState(String(initial.smtp.port));
  const [secure, setSecure] = useState(initial.smtp.secure);
  const [user, setUser] = useState(initial.smtp.user);
  const [password, setPassword] = useState('');
  const [testTo, setTestTo] = useState(adminEmail);
  const [busy, setBusy] = useState<'save' | 'test' | 'clear' | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const closeToast = useCallback(() => setToast(null), []);

  /** The saved SMTP password is kept only for the same server, port and username; changing any of them means typing it again. */
  const keepsPassword = view.smtp.passwordSet && host.trim().toLowerCase() === view.smtp.host && Number(port) === view.smtp.port && user.trim() === view.smtp.user;

  /** Shows what the server saved, so the boxes match it and the secret boxes are empty again. */
  function adopt(v: EmailSettingsView) {
    setView(v); setProvider(v.provider); setFrom(v.from); setApiKey(''); setOtpFrom(v.otpFrom);
    setSFrom(v.smtp.from); setHost(v.smtp.host); setPort(String(v.smtp.port)); setSecure(v.smtp.secure); setUser(v.smtp.user); setPassword('');
  }

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
        <p className="settings-lead">Sends the confirmation code when someone asks to host a workshop. Send it with Resend (verify your domain there first) or with any SMTP mail account.</p>
      <form className="admin-form" onSubmit={async e => {
        e.preventDefault();
        const body = provider === 'smtp' ? { provider, from: sFrom, host, port: Number(port), secure, user, password } : { provider, from, apiKey, otpFrom };
        const data = await call('save', '/api/admin/settings/email', 'PUT', body);
        if (data) { adopt(data as EmailSettingsView); notify('success', 'Email settings saved.'); }
      }}>
        <p className="form-note">
          {view.source === 'saved' ? `Sending with ${view.provider === 'smtp' ? 'SMTP' : 'Resend'}, using the settings saved here.` : SOURCE[view.source]}
          {view.provider === 'resend' && view.apiKeySet && view.apiKeyHint ? ` Current API key ends in ${view.apiKeyHint}.` : ''}
        </p>
        {error && <p role="alert" className="admin-error">{error}</p>}
        <label><span className="lbl">Send with</span>
          <select name="provider" value={provider} onChange={e => setProvider(e.target.value as MailProvider)}>
            <option value="resend">Resend (API key, your own verified domain)</option>
            <option value="smtp">SMTP (Gmail, Hostinger or any mail server)</option>
          </select>
        </label>
        {provider === 'resend' ? (
          <>
            <label><span className="lbl">Send emails from</span>
              <input name="from" type="text" required maxLength={200} value={from} onChange={e => setFrom(e.target.value)} placeholder="Craftofy <hello@yourdomain.com>" autoComplete="off" />
              <small>An address on a domain you verified in Resend.</small>
            </label>
            <label><span className="lbl">Resend API key</span>
              <input name="apiKey" type="password" required={!view.apiKeySet || view.source !== 'saved'} maxLength={300} value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder={view.apiKeySet && view.source === 'saved' ? 'Leave empty to keep the saved key' : 're_...'} autoComplete="new-password" />
              <small>Stored encrypted. It is never shown again after you save.</small>
            </label>
            <label><span className="lbl">Email verification sender</span>
              <input name="otpFrom" type="text" maxLength={200} value={otpFrom} onChange={e => setOtpFrom(e.target.value)} placeholder={OTP_FROM} autoComplete="off" />
              <small>Optional. The email verification code that visitors get is sent from this address. Leave empty to use {OTP_FROM}. It must be on the domain you verified in Resend; nothing else needs setting up.</small>
            </label>
          </>
        ) : (
          <>
            <label><span className="lbl">Send emails from</span>
              <input name="smtpFrom" type="text" required maxLength={200} value={sFrom} onChange={e => setSFrom(e.target.value)} placeholder="Craftofy <hello.craftofy@gmail.com>" autoComplete="off" />
              <small>Gmail and most servers only send as your own account, so use the login address here.</small>
            </label>
            <div className="admin-form-row">
              <label><span className="lbl">SMTP server</span>
                <input name="host" type="text" required maxLength={253} value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.gmail.com" autoComplete="off" />
              </label>
              <label><span className="lbl">Port</span>
                <input name="port" type="number" required min={1} max={65535} value={port} onChange={e => setPort(e.target.value)} />
              </label>
            </div>
            <label className="check"><input name="secure" type="checkbox" checked={secure} onChange={e => { setSecure(e.target.checked); setPort(p => (p === '465' || p === '587') ? (e.target.checked ? '465' : '587') : p); }} />
              <span>Use SSL (port 465). Untick for STARTTLS (port 587).</span>
            </label>
            <label><span className="lbl">Username</span>
              <input name="user" type="text" required maxLength={254} value={user} onChange={e => setUser(e.target.value)} placeholder="hello.craftofy@gmail.com" autoComplete="off" />
            </label>
            <label><span className="lbl">Password</span>
              <input name="password" type="password" required={!keepsPassword} maxLength={200} value={password} onChange={e => setPassword(e.target.value)}
                placeholder={keepsPassword ? 'Leave empty to keep the saved password' : 'Password or app password'} autoComplete="new-password" />
              <small>For Gmail, use an App Password (Google Account &gt; Security &gt; 2-Step Verification &gt; App passwords), not your normal password. Stored encrypted and never shown again.</small>
            </label>
          </>
        )}
        <div className="admin-actions">
          {view.source === 'saved' && (
            <button type="button" className="button danger-outline" disabled={!!busy} aria-busy={busy === 'clear'} onClick={async () => {
              if (!window.confirm('Remove all saved email settings (Resend and SMTP)? Email falls back to the server environment variables, if set.')) return;
              const data = await call('clear', '/api/admin/settings/email', 'DELETE');
              if (data) { adopt(data as EmailSettingsView); notify('success', 'Saved email settings removed.'); }
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

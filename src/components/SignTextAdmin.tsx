'use client';
import { useCallback, useState } from 'react';
import { Toast, type ToastState } from './Toast';
import { signFor, type SignText } from '@/lib/workshop-sign-text';

/** The words on the café board of /workshops: what it says with no workshop live today, with one, and with several. */
export function SignTextAdmin({ initial }: { initial: SignText }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const set = (k: keyof SignText) => (e: React.ChangeEvent<HTMLInputElement>) => setText(t => ({ ...t, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/admin/workshop-sign', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(text) });
      const data = await r.json().catch(() => null);
      if (!r.ok) setError(data?.error ?? 'Could not save. Please try again.');
      else { setText(data); setToast({ id: Date.now(), kind: 'success', text: 'Board text saved.' }); }
    } catch { setError('Network error. Please try again.'); }
    setBusy(false);
  }

  return (
    <section className="sign-admin" aria-labelledby="sign-admin-h">
      <h2 id="sign-admin-h">Text on the café board</h2>
      <p className="form-note">The board in the picture on the Workshops page. Use <b>{'{n}'}</b> for the number of live workshops. Up to 20 characters each; a longer text goes on two lines.</p>
      <form className="admin-form" onSubmit={save}>
        <div className="admin-form-row">
          <label>When no workshop is live today<input value={text.idle} onChange={set('idle')} maxLength={20} required /></label>
          <label>When one workshop is live<input value={text.one} onChange={set('one')} maxLength={20} required /></label>
          <label>When several workshops are live<input value={text.many} onChange={set('many')} maxLength={20} required /></label>
        </div>
        <p className="form-note" data-testid="sign-preview">Preview: {signFor(text, 0)} · {signFor(text, 1)} · {signFor(text, 2)}</p>
        {error && <p role="alert" className="admin-error">{error}</p>}
        <div className="admin-actions"><button type="submit" className="button primary" disabled={busy} aria-busy={busy}>Save board text</button></div>
      </form>
      <Toast toast={toast} onClose={closeToast} />
    </section>
  );
}

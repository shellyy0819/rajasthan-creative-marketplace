'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast, type ToastState } from './Toast';
import type { ShareSettings, ShareVisibility } from '@/lib/share-settings';

const HELP: Record<ShareVisibility, string> = {
  admin: 'Only admins see the Share button, on product, workshop, artist and category pages. Visitors, customers and sellers do not see it and its code is not sent to them.',
  everyone: 'Every visitor sees the Share button and can share a page to WhatsApp, Instagram or Facebook, or copy its link.',
};

/** Admin switch for the Share button: admins only while it is being tried out, then everyone. */
export function ShareSettingsForm({ initial }: { initial: ShareSettings }) {
  const [saved, setSaved] = useState<ShareVisibility>(initial.visibility);
  const [visibility, setVisibility] = useState<ShareVisibility>(initial.visibility);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);

  return (
    <div className="admin-grid admin-grid-solo">
      <Toast toast={toast} onClose={closeToast} />
      <section className="settings-card" aria-labelledby="share-settings-h">
        <h2 id="share-settings-h">Sharing</h2>
        <p className="settings-lead">The Share button lets a visitor send a product, workshop, artist or category page to a friend on WhatsApp, Instagram or Facebook.</p>
        <form className="admin-form" onSubmit={async e => {
          e.preventDefault();
          if (busy) return;
          setBusy(true); setError('');
          try {
            const r = await fetch('/api/admin/settings/share', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ visibility }) });
            const data = await r.json().catch(() => null);
            if (!r.ok) { setError((data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.'); return; }
            setSaved((data as ShareSettings).visibility);
            router.refresh();
            setToast({ id: Date.now() + Math.random(), kind: 'success', text: 'Sharing settings saved.' });
          } catch { setError('Network error. Please try again.'); }
          finally { setBusy(false); }
        }}>
          <p className="form-note">{saved === 'everyone' ? 'Right now every visitor sees the Share button.' : 'Right now only admins see the Share button.'}</p>
          {error && <p role="alert" className="admin-error">{error}</p>}
          <label><span className="lbl">Who sees the Share button</span>
            <select name="visibility" value={visibility} onChange={e => setVisibility(e.target.value as ShareVisibility)}>
              <option value="admin">Admins only (testing)</option>
              <option value="everyone">Everyone</option>
            </select>
            <small>{HELP[visibility]}</small>
          </label>
          <div className="admin-actions">
            <button type="submit" className="button primary" disabled={busy} aria-busy={busy}>Save</button>
          </div>
        </form>
      </section>
    </div>
  );
}

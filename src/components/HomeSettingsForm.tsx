'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast, type ToastState } from './Toast';
import { MAX_HOME_PRODUCT_LIMIT, MIN_HOME_PRODUCT_LIMIT } from '@/lib/catalog-shared';
import type { HomeSettings } from '@/lib/home-settings';

/** Admin setting for the home page: how many products the "Finds" shelf shows. Visitors see the rest, with filters, on /shop. */
export function HomeSettingsForm({ initial }: { initial: HomeSettings }) {
  const [saved, setSaved] = useState(initial.productLimit);
  const [limit, setLimit] = useState(String(initial.productLimit));
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);

  return (
    <div className="admin-grid admin-grid-solo">
      <Toast toast={toast} onClose={closeToast} />
      <section className="settings-card" aria-labelledby="home-settings-h">
        <h2 id="home-settings-h">Home page</h2>
        <p className="settings-lead">The “Finds” shelf on the home page shows a short selection of products. Everything else, with filters, is on the Products page.</p>
        <form className="admin-form" onSubmit={async e => {
          e.preventDefault();
          if (busy) return;
          setBusy(true); setError('');
          try {
            const r = await fetch('/api/admin/settings/home', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productLimit: Number(limit) }) });
            const data = await r.json().catch(() => null);
            if (!r.ok) { setError((data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.'); return; }
            setSaved((data as HomeSettings).productLimit);
            router.refresh();
            setToast({ id: Date.now() + Math.random(), kind: 'success', text: 'Home page settings saved.' });
          } catch { setError('Network error. Please try again.'); }
          finally { setBusy(false); }
        }}>
          <p className="form-note">Right now the home page shows {saved} products.</p>
          {error && <p role="alert" className="admin-error">{error}</p>}
          <label><span className="lbl">Products on the home page</span>
            <input name="productLimit" type="number" inputMode="numeric" required min={MIN_HOME_PRODUCT_LIMIT} max={MAX_HOME_PRODUCT_LIMIT} step={1} value={limit} onChange={e => setLimit(e.target.value)} />
            <small>A whole number from {MIN_HOME_PRODUCT_LIMIT} to {MAX_HOME_PRODUCT_LIMIT}.</small>
          </label>
          <div className="admin-actions">
            <button type="submit" className="button primary" disabled={busy} aria-busy={busy}>Save</button>
          </div>
        </form>
      </section>
    </div>
  );
}

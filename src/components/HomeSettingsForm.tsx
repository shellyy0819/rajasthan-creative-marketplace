'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast, type ToastState } from './Toast';
import { MAX_HOME_MIN_WORKSHOPS, MAX_HOME_PRODUCT_LIMIT, MIN_HOME_MIN_WORKSHOPS, MIN_HOME_PRODUCT_LIMIT } from '@/lib/catalog-shared';
import type { HomeSettings } from '@/lib/home-settings';

/** Admin settings for the home page: how many products the "Finds" shelf shows (visitors see the rest, with filters, on /shop), and how many workshops must be on before the workshop section appears. */
export function HomeSettingsForm({ initial }: { initial: HomeSettings }) {
  const [saved, setSaved] = useState(initial.productLimit);
  const [limit, setLimit] = useState(String(initial.productLimit));
  const [savedMin, setSavedMin] = useState(initial.minWorkshops);
  const [minWs, setMinWs] = useState(String(initial.minWorkshops));
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
            const r = await fetch('/api/admin/settings/home', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productLimit: Number(limit), minWorkshops: Number(minWs) }) });
            const data = await r.json().catch(() => null);
            if (!r.ok) { setError((data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.'); return; }
            setSaved((data as HomeSettings).productLimit);
            setSavedMin((data as HomeSettings).minWorkshops);
            router.refresh();
            setToast({ id: Date.now() + Math.random(), kind: 'success', text: 'Home page settings saved.' });
          } catch { setError('Network error. Please try again.'); }
          finally { setBusy(false); }
        }}>
          <p className="form-note">Right now the home page shows {saved} products, and {savedMin === 0 ? 'always shows the workshops section' : `shows the workshops section once ${savedMin} or more workshops are on`}.</p>
          {error && <p role="alert" className="admin-error">{error}</p>}
          <label><span className="lbl">Products on the home page</span>
            <input name="productLimit" type="number" inputMode="numeric" required min={MIN_HOME_PRODUCT_LIMIT} max={MAX_HOME_PRODUCT_LIMIT} step={1} value={limit} onChange={e => setLimit(e.target.value)} />
            <small>A whole number from {MIN_HOME_PRODUCT_LIMIT} to {MAX_HOME_PRODUCT_LIMIT}.</small>
          </label>
          <label><span className="lbl">Workshops needed to show the workshops section</span>
            <input name="minWorkshops" type="number" inputMode="numeric" required min={MIN_HOME_MIN_WORKSHOPS} max={MAX_HOME_MIN_WORKSHOPS} step={1} value={minWs} onChange={e => setMinWs(e.target.value)} />
            <small>The workshops section is hidden on the home page until at least this many workshops are on (published and not ended). A whole number from {MIN_HOME_MIN_WORKSHOPS} to {MAX_HOME_MIN_WORKSHOPS}; 0 always shows it.</small>
          </label>
          <div className="admin-actions">
            <button type="submit" className="button primary" disabled={busy} aria-busy={busy}>Save</button>
          </div>
        </form>
      </section>
    </div>
  );
}

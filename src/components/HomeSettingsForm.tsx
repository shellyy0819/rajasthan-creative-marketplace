'use client';
import { useCallback, useState } from 'react';
import { Toast, type ToastState } from './Toast';
import { MAKERS_ROTATE_MAX_SECONDS, MAKERS_ROTATE_MIN_SECONDS, validRotateSeconds, type HomeSettings } from '@/lib/home-settings-shared';

/** Admin options for the home page. For now: how long the "Our sellers" carousel stays on each maker. */
export function HomeSettingsForm({ initial }: { initial: HomeSettings }) {
  const [saved, setSaved] = useState(initial.makersRotateSeconds);
  const [seconds, setSeconds] = useState(String(initial.makersRotateSeconds));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);

  return (
    <div className="admin-grid admin-grid-solo">
      <Toast toast={toast} onClose={closeToast} />
      <section className="settings-card" aria-labelledby="home-makers-h">
        <h2 id="home-makers-h">Our sellers carousel</h2>
        <p className="settings-lead">The &ldquo;Say namaste to the people behind your piece&rdquo; section on the home page shows one seller at a time and moves on by itself. Choose how long it stays on each one.</p>
        <form className="admin-form" noValidate onSubmit={async e => {
          e.preventDefault();
          if (busy) return;
          const n = Number(seconds);
          if (seconds.trim() === '' || !validRotateSeconds(n)) { setError(`Enter a whole number of seconds from ${MAKERS_ROTATE_MIN_SECONDS} to ${MAKERS_ROTATE_MAX_SECONDS}.`); return; }
          setBusy(true); setError('');
          try {
            const r = await fetch('/api/admin/settings/home', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ makersRotateSeconds: n }) });
            const data = await r.json().catch(() => null);
            if (!r.ok) { setError((data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.'); return; }
            setSaved((data as HomeSettings).makersRotateSeconds); setSeconds(String((data as HomeSettings).makersRotateSeconds));
            setToast({ id: Date.now() + Math.random(), kind: 'success', text: 'Home settings saved.' });
          } catch { setError('Network error. Please try again.'); }
          finally { setBusy(false); }
        }}>
          <p className="form-note">Right now the carousel moves to the next seller every {saved} {saved === 1 ? 'second' : 'seconds'}. It pauses while a visitor hovers, touches or tabs into it, and does not move by itself for visitors who prefer reduced motion.</p>
          {error && <p role="alert" className="admin-error" id="home-seconds-err">{error}</p>}
          <label><span className="lbl">Seconds on each seller</span>
            <input name="makersRotateSeconds" type="number" inputMode="numeric" min={MAKERS_ROTATE_MIN_SECONDS} max={MAKERS_ROTATE_MAX_SECONDS} step={1} value={seconds}
              onChange={e => { setSeconds(e.target.value); setError(''); }} aria-describedby={error ? 'home-seconds-err' : undefined} required />
            <small>From {MAKERS_ROTATE_MIN_SECONDS} to {MAKERS_ROTATE_MAX_SECONDS} seconds. The new time shows for visitors the next time they open the home page.</small>
          </label>
          <div className="admin-actions">
            <button type="submit" className="button primary" disabled={busy} aria-busy={busy}>Save</button>
          </div>
        </form>
      </section>
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { PHONE_HINT, PHONE_PATTERN } from '@/lib/phone';
import type { SellerProfile } from '@/lib/types';

type Props = {
  title: string;
  initial: SellerProfile;
  /** Where to PUT the profile: /api/profile for your own, /api/admin/users/:id/profile for another seller. */
  url: string;
  /** The account's sign-in email: offered (never filled automatically) as the public email. */
  accountEmail?: string;
  onSaved: (p: SellerProfile) => void;
  onCancel: () => void;
};

const field = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** Public name and contact shown on a seller's product pages. */
export function ProfileDialog({ title, initial, url, accountEmail, onSaved, onCancel }: Props) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saving, onCancel]);

  return (
    <div className="admin-modal">
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="profile-title" className="admin-form-card">
        <div className="dialog-head">
          <h2 id="profile-title">{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onCancel} disabled={saving}>✕</button>
        </div>
        <form className="admin-form" onSubmit={async e => {
          e.preventDefault();
          if (saving) return;
          setSaving(true); setError('');
          const f = new FormData(e.currentTarget);
          try {
            const r = await fetch(url, {
              method: 'PUT', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ displayName: field(f, 'displayName'), publicPhone: field(f, 'publicPhone'), publicEmail: field(f, 'publicEmail'), instagram: field(f, 'instagram'), youtube: field(f, 'youtube') }),
            });
            const body = await r.json().catch(() => null);
            if (!r.ok) { setError(body?.error ?? 'Something went wrong. Please try again.'); setSaving(false); return; }
            onSaved(body as SellerProfile);
          } catch { setError('Network error. Please try again.'); setSaving(false); }
        }}>
          <p className="form-note"><b>*</b> Required. Shown publicly on this seller’s product pages.</p>
          {error && <p role="alert" className="admin-error">{error}</p>}
          <label><span className="lbl">Display name</span><input name="displayName" required maxLength={100} defaultValue={initial.displayName} autoFocus /></label>
          <div className="admin-form-row">
            <label>Public phone<input name="publicPhone" type="tel" inputMode="tel" maxLength={40} pattern={PHONE_PATTERN} title={PHONE_HINT} placeholder="9989898999" defaultValue={initial.publicPhone ?? ''} /></label>
            <label>Public email<input ref={emailRef} name="publicEmail" type="email" maxLength={200} defaultValue={initial.publicEmail ?? ''} />
              <small>Shown publicly on your product pages. Leave empty to hide it.</small>
              {accountEmail && <button type="button" className="button" style={{ marginTop: 6 }} onClick={() => { if (emailRef.current) emailRef.current.value = accountEmail; }}>Use my sign-in email ({accountEmail})</button>}
            </label>
          </div>
          <div className="admin-form-row">
            <label>Instagram<input name="instagram" maxLength={200} defaultValue={initial.instagram ?? ''} /></label>
            <label>YouTube<input name="youtube" maxLength={200} defaultValue={initial.youtube ?? ''} /></label>
          </div>
          <div className="admin-actions">
            <button type="button" className="button" onClick={onCancel} disabled={saving}>Cancel</button>
            <button type="submit" className="button primary" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

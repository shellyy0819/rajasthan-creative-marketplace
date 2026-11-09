'use client';
import { useEffect, useState } from 'react';
import type { SellerProfile } from '@/lib/types';
import { FieldError } from './onboarding/FieldError';
import { LogoUpload } from './onboarding/LogoUpload';

const METHOD_LABEL = { whatsapp: 'WhatsApp', instagram: 'Instagram', website: 'Website', phone: 'Phone' } as const;

/** A seller's own details after onboarding: read only, except that a missing logo can still be added. */
export function ProfileView({ profile, onLogoSaved, onClose }: {
  profile: SellerProfile; onLogoSaved: (p: SellerProfile) => void; onClose: () => void;
}) {
  const [logoUrl, setLogoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  async function saveLogo() {
    if (!logoUrl || saving || busy) return;
    setSaving(true); setError('');
    try {
      const r = await fetch('/api/profile/logo', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ logoUrl }) });
      const body = await r.json().catch(() => null);
      if (!r.ok) { setError(typeof body?.error === 'string' ? body.error : 'Something went wrong. Please try again.'); setSaving(false); return; }
      onLogoSaved(body as SellerProfile);
    } catch { setError('Network error. Please try again.'); setSaving(false); }
  }

  const rows: [string, string | undefined][] = [
    ['Business name', profile.displayName],
    ['Category', profile.category],
    ['City', profile.city],
    ['Short description', profile.bio],
    ['Email', profile.publicEmail],
    ['Mobile', profile.publicPhone],
    ['WhatsApp', profile.whatsapp],
    ['Instagram', profile.instagram],
    ['Website', profile.website],
    ['Customers can reach you by', profile.contactMethods?.map(m => METHOD_LABEL[m]).join(', ')],
  ];
  return (
    <div className="admin-modal">
      <div role="dialog" aria-modal="true" aria-labelledby="profile-view-title" className="admin-form-card">
        <div className="dialog-head">
          <h2 id="profile-view-title">My profile</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} disabled={saving}>✕</button>
        </div>
        <div className="admin-form">
          <p className="form-note">Your details are locked. Contact Craftofy to change them.</p>
          {profile.logoUrl ? (
            <div className="logo-upload">
              <div className="logo-preview has-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.logoUrl} alt="Your logo" referrerPolicy="no-referrer" />
              </div>
            </div>
          ) : (
            <fieldset className="profile-onboarding">
              <legend>Logo</legend>
              <p className="onboard-hint">You have not added a logo yet. Add one now; once saved it cannot be changed here.</p>
              <LogoUpload value={logoUrl} onChange={u => { setLogoUrl(u); setError(''); }} onBusyChange={setBusy} />
              {error && <FieldError id="err-profile-view-logo" message={error} />}
              <button type="button" className="button primary" disabled={!logoUrl || busy || saving} aria-busy={saving} onClick={saveLogo}>{saving ? 'Saving…' : 'Save logo'}</button>
            </fieldset>
          )}
          <dl className="profile-view">
            {rows.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          <div className="admin-actions"><button type="button" className="button" onClick={onClose} disabled={saving}>Close</button></div>
        </div>
      </div>
    </div>
  );
}

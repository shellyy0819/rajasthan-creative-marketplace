'use client';
import { useEffect, useState } from 'react';
import type { SellerProfile } from '@/lib/types';
import { FieldError } from './onboarding/FieldError';
import { LogoUpload } from './onboarding/LogoUpload';

const METHOD_LABEL = { whatsapp: 'WhatsApp', instagram: 'Instagram', website: 'Website', phone: 'Phone' } as const;

/** A seller's own details after onboarding: read only, except that a missing logo can still be added. */
export function ProfileView({ profile, publicPageHref, onLogoSaved, onClose }: {
  profile: SellerProfile; publicPageHref?: string; onLogoSaved: (p: SellerProfile) => void; onClose: () => void;
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
    ['Email', profile.publicEmail],
    ['Mobile', profile.publicPhone],
    ['WhatsApp', profile.whatsapp],
    ['Instagram', profile.instagram],
    ['Website', profile.website],
    ['Customers can reach you by', profile.contactMethods?.map(m => METHOD_LABEL[m]).join(', ')],
  ];
  const shown = rows.filter(([, v]) => v);
  return (
    <div className="admin-modal">
      <div role="dialog" aria-modal="true" aria-labelledby="profile-view-title" className="admin-form-card">
        <div className="dialog-head">
          <h2 id="profile-view-title">My profile</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} disabled={saving}>✕</button>
        </div>
        <div className="admin-form">
          <div className="profile-id">
            <div className={`logo-preview${profile.logoUrl ? ' has-photo' : ''}`}>
              {profile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.logoUrl} alt="Your logo" referrerPolicy="no-referrer" />
              ) : <span aria-hidden="true">{profile.displayName.charAt(0).toUpperCase()}</span>}
            </div>
            <div className="profile-id-text">
              <h3 className="profile-name">{profile.displayName}</h3>
              {(profile.category || profile.city) && (
                <p className="profile-tags">
                  {profile.category && <span>{profile.category}</span>}
                  {profile.city && <span>{profile.city}</span>}
                </p>
              )}
            </div>
          </div>
          {!profile.logoUrl && (
            <fieldset className="profile-onboarding">
              <legend>Logo</legend>
              <p className="onboard-hint">You have not added a logo yet. Add one now; once saved it cannot be changed here.</p>
              <LogoUpload value={logoUrl} onChange={u => { setLogoUrl(u); setError(''); }} onBusyChange={setBusy} />
              {error && <FieldError id="err-profile-view-logo" message={error} />}
              <button type="button" className="button primary" disabled={!logoUrl || busy || saving} aria-busy={saving} onClick={saveLogo}>{saving ? 'Saving…' : 'Save logo'}</button>
            </fieldset>
          )}
          {profile.bio && (
            <section className="profile-section">
              <h4 className="profile-sub">About</h4>
              <p className="profile-bio">{profile.bio}</p>
            </section>
          )}
          {shown.length > 0 && (
            <section className="profile-section">
              <h4 className="profile-sub">Contact</h4>
              <dl className="profile-view">
                {shown.map(([k, v]) => (
                  <div key={k} className={k === 'Customers can reach you by' ? 'wide' : undefined}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </section>
          )}
          <div className="admin-actions profile-actions">
            {publicPageHref
              ? <a className="button primary" href={publicPageHref} target="_blank" rel="noopener noreferrer">View my public page ↗</a>
              : <p className="onboard-hint">Your public page appears once your first product is approved.</p>}
            <button type="button" className="button" onClick={onClose} disabled={saving}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

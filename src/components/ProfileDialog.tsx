'use client';
import { useEffect, useRef, useState } from 'react';
import { PHONE_HINT, PHONE_PATTERN } from '@/lib/phone';
import { validateContactMethods, validateWebsite, validateWhatsapp } from '@/lib/onboarding-validate';
import type { ContactMethod, SellerProfile } from '@/lib/types';
import { CityInput } from './CityInput';
import { FieldError } from './onboarding/FieldError';
import { LogoUpload } from './onboarding/LogoUpload';

type Props = {
  title: string;
  initial: SellerProfile;
  /** Where to PUT the profile: /api/profile for your own, /api/admin/users/:id/profile for another seller. */
  url: string;
  /** The account's sign-in email: offered (never filled automatically) as the public email. */
  accountEmail?: string;
  /** False when editing someone else's profile: the upload route stores files under the signed-in user, so only the owner can change the logo. */
  canUploadLogo?: boolean;
  onSaved: (p: SellerProfile) => void;
  onCancel: () => void;
};

const METHODS: { id: ContactMethod; label: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp' }, { id: 'instagram', label: 'Instagram' }, { id: 'website', label: 'Website' }, { id: 'phone', label: 'Phone' },
];
/** Server field names that map onto a control in this dialog, in page order (the first one gets focus). */
const ORDER = ['displayName', 'publicPhone', 'instagram', 'website', 'category', 'logoUrl', 'contactMethods', 'whatsapp'] as const;
type ErrKey = (typeof ORDER)[number];
const field = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
/** A chosen suggestion (signed cityRef) or the untouched current city (cityId); neither clears the artist city. */
function cityOf(f: FormData): { cityRef: string } | { cityId: number } | Record<string, never> {
  const ref = field(f, 'cityRef'), id = Number(field(f, 'cityId'));
  if (ref) return { cityRef: ref };
  if (field(f, 'cityId') && Number.isInteger(id)) return { cityId: id };
  return {};
}

/** Public name and contact shown on a seller's product pages. */
export function ProfileDialog({ title, initial, url, accountEmail, canUploadLogo = true, onSaved, onCancel }: Props) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Partial<Record<ErrKey, string>>>({});
  const [methods, setMethods] = useState<ContactMethod[]>(initial.contactMethods ?? []);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? '');
  const [logoBusy, setLogoBusy] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesDown, setCategoriesDown] = useState(false);
  const bad = (k: ErrKey) => (errors[k] ? true : undefined);
  const desc = (k: ErrKey) => (errors[k] ? `err-profile-${k}` : undefined);
  const focusFirst = (errs: Partial<Record<ErrKey, string>>) => {
    const k = ORDER.find(x => errs[x]);
    const el = k ? formRef.current?.querySelector<HTMLElement>(k === 'contactMethods' ? '[data-method]' : k === 'logoUrl' ? '[data-field="logoUrl"]' : `[name="${k}"]`) : null;
    el?.scrollIntoView?.({ block: 'center' });
    el?.focus();
  };

  /** A new field is sent when it has a value or the profile had one (so clearing works); otherwise it is left out. */
  const onboardingFields = (f: FormData) => {
    const out: Record<string, unknown> = {};
    for (const k of ['website', 'category', 'whatsapp'] as const) { const v = field(f, k); if (v || initial[k]) out[k] = v; }
    if (canUploadLogo && (logoUrl || initial.logoUrl)) out.logoUrl = logoUrl;
    if (methods.length || initial.contactMethods?.length) out.contactMethods = methods;
    return out;
  };

  useEffect(() => {
    let live = true;
    fetch('/api/categories')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('categories'))))
      .then((list: unknown) => { if (live && Array.isArray(list)) setCategories(list.filter((x): x is string => typeof x === 'string')); })
      .catch(() => { if (live) setCategoriesDown(true); });
    return () => { live = false; };
  }, []);
  const categoryOptions = initial.category && !categories.includes(initial.category) ? [initial.category, ...categories] : categories;

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
        <form ref={formRef} className="admin-form" noValidate onChange={e => {
          const n = (e.target as unknown as HTMLInputElement).name as ErrKey;
          if (n && errors[n]) setErrors(({ [n]: _, ...rest }) => rest);
        }} onSubmit={async e => {
          e.preventDefault();
          if (saving || logoBusy) return;
          const f = new FormData(e.currentTarget);
          const local: Partial<Record<ErrKey, string>> = {};
          const web = validateWebsite(field(f, 'website')); if (!web.ok) local.website = web.error;
          const wa = validateWhatsapp(field(f, 'whatsapp')); if (!wa.ok) local.whatsapp = wa.error;
          if (methods.length) {
            const cm = validateContactMethods(methods, { mobile: field(f, 'publicPhone'), whatsapp: field(f, 'whatsapp'), instagram: field(f, 'instagram'), website: field(f, 'website') });
            if (!cm.ok) for (const [k, m] of Object.entries(cm.errors)) {
              if (k === 'mobile') local.publicPhone ??= 'Add a public phone to list Phone.';
              else if ((ORDER as readonly string[]).includes(k)) local[k as ErrKey] ??= m;
            }
          }
          if (Object.keys(local).length) { setErrors(local); focusFirst(local); return; }
          setErrors({});
          setSaving(true); setError('');
          try {
            const r = await fetch(url, {
              method: 'PUT', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ displayName: field(f, 'displayName'), publicPhone: field(f, 'publicPhone'), publicEmail: field(f, 'publicEmail'), instagram: field(f, 'instagram'), youtube: field(f, 'youtube'), bio: field(f, 'bio'), ...onboardingFields(f), ...cityOf(f) }),
            });
            const body = await r.json().catch(() => null);
            if (!r.ok) {
              const k = ORDER.find(x => x === body?.field);
              if (k && typeof body?.error === 'string') { const e1 = { [k]: body.error }; setErrors(e1); focusFirst(e1); }
              else setError(body?.error ?? 'Something went wrong. Please try again.');
              setSaving(false); return;
            }
            onSaved(body as SellerProfile);
          } catch { setError('Network error. Please try again.'); setSaving(false); }
        }}>
          <p className="form-note"><b>*</b> Required. Shown publicly on this seller’s product pages.</p>
          {error && <p role="alert" className="admin-error">{error}</p>}
          <label><span className="lbl">Display name</span><input name="displayName" required maxLength={100} defaultValue={initial.displayName} autoFocus aria-invalid={bad('displayName')} aria-describedby={desc('displayName')} /></label>
          <FieldError id="err-profile-displayName" message={errors.displayName} />
          <div className="admin-form-row">
            <label>Public phone<input name="publicPhone" type="tel" inputMode="tel" maxLength={40} pattern={PHONE_PATTERN} title={PHONE_HINT} placeholder="9989898999" defaultValue={initial.publicPhone ?? ''} aria-invalid={bad('publicPhone')} aria-describedby={desc('publicPhone')} />
              <FieldError id="err-profile-publicPhone" message={errors.publicPhone} /></label>
            <label>Public email<input ref={emailRef} name="publicEmail" type="email" maxLength={200} defaultValue={initial.publicEmail ?? ''} />
              <small>Shown publicly on your product pages. Leave empty to hide it.</small>
              {accountEmail && <button type="button" className="button" style={{ marginTop: 6 }} onClick={() => { if (emailRef.current) emailRef.current.value = accountEmail; }}>Use my sign-in email ({accountEmail})</button>}
            </label>
          </div>
          <div className="admin-form-row">
            <label>Instagram<input name="instagram" maxLength={200} defaultValue={initial.instagram ?? ''} aria-invalid={bad('instagram')} aria-describedby={desc('instagram')} />
              <FieldError id="err-profile-instagram" message={errors.instagram} /></label>
            <label>YouTube<input name="youtube" maxLength={200} defaultValue={initial.youtube ?? ''} /></label>
          </div>
          <div className="admin-form-row">
            <label>City<CityInput defaultCity={initial.cityId && initial.city ? { id: initial.cityId, label: initial.city } : undefined} /></label>
          </div>
          <div className="admin-form-row">
            <label>Website<input name="website" type="url" inputMode="url" maxLength={200} placeholder="https://" defaultValue={initial.website ?? ''} aria-invalid={bad('website')} aria-describedby={desc('website')} />
              <FieldError id="err-profile-website" message={errors.website} /></label>
            <label>Category
              <select name="category" defaultValue={initial.category ?? ''} aria-invalid={bad('category')} aria-describedby={desc('category')}>
                <option value="">No category</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {categoriesDown && <small>Categories could not be loaded.</small>}
              <FieldError id="err-profile-category" message={errors.category} />
            </label>
          </div>
          <fieldset className="profile-onboarding">
            <legend>Logo and contact options</legend>
            {canUploadLogo
              ? <LogoUpload value={logoUrl} onChange={u => { setLogoUrl(u); setErrors(({ logoUrl: _, ...rest }) => rest); }} onBusyChange={setLogoBusy}
                  invalid={!!errors.logoUrl} describedBy={desc('logoUrl')} />
              : (
                <div className="logo-upload">
                  <div className={`logo-preview${logoUrl ? ' has-photo' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {logoUrl ? <img src={logoUrl} alt="Seller logo" /> : <span aria-hidden="true">Logo</span>}
                  </div>
                  <div className="logo-actions"><small className="onboard-hint">Only the seller can change their logo.</small></div>
                </div>
              )}
            <FieldError id="err-profile-logoUrl" message={errors.logoUrl} />
            <p className="onboard-hint" id="contact-methods-label">How customers can reach you</p>
            <div className="onboard-toggles" role="group" aria-labelledby="contact-methods-label" aria-describedby={desc('contactMethods')}>
              {METHODS.map(m => {
                const on = methods.includes(m.id);
                return (
                  <button key={m.id} type="button" data-method={m.id} className={`onboard-toggle${on ? ' on' : ''}`} aria-pressed={on}
                    onClick={() => { setMethods(on ? methods.filter(x => x !== m.id) : [...methods, m.id]); setErrors(({ contactMethods: _, ...rest }) => rest); }}>{m.label}</button>
                );
              })}
            </div>
            <FieldError id="err-profile-contactMethods" message={errors.contactMethods} />
            <label>WhatsApp number<input name="whatsapp" type="tel" inputMode="numeric" autoComplete="off" maxLength={14} defaultValue={initial.whatsapp ?? ''} aria-invalid={bad('whatsapp')} aria-describedby={desc('whatsapp')} />
              <small>10-digit Indian mobile number.</small>
              <FieldError id="err-profile-whatsapp" message={errors.whatsapp} />
            </label>
          </fieldset>
          <label>About the artist<textarea name="bio" rows={4} maxLength={500} placeholder="A few lines about you and your craft." defaultValue={initial.bio ?? ''} />
            <small>Shown on your Contact artist sheet and artist page. Up to 500 characters.</small>
          </label>
          <div className="admin-actions">
            <button type="button" className="button" onClick={onCancel} disabled={saving}>Cancel</button>
            <button type="submit" className="button primary" disabled={saving || logoBusy} aria-busy={saving || logoBusy}>{saving ? 'Saving…' : 'Save profile'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

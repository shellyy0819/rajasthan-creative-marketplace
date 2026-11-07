'use client';
import { useEffect, useRef, useState } from 'react';
import { CityInput, type PickedCity } from '@/components/CityInput';
import { FieldError } from '@/components/onboarding/FieldError';
import { LogoUpload } from '@/components/onboarding/LogoUpload';
import { validateOnboarding, type FieldErrors, type OnboardingInput } from '@/lib/onboarding-validate';
import type { ContactMethod } from '@/lib/types';

export const DESCRIPTION_MAX = 200;

export type Craft = {
  brandName: string; category: string; description: string; city: PickedCity | null;
  instagram: string; website: string; logoUrl: string;
  contactMethods: ContactMethod[]; sameAsMobile: boolean; whatsapp: string;
};
export const EMPTY_CRAFT: Craft = {
  brandName: '', category: '', description: '', city: null, instagram: '', website: '', logoUrl: '',
  contactMethods: [], sameAsMobile: true, whatsapp: '',
};

const METHODS: { id: ContactMethod; label: string; note?: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram', note: 'Instagram uses the handle you entered above.' },
  { id: 'website', label: 'Website', note: 'Website uses the link you entered above.' },
  { id: 'phone', label: 'Phone', note: 'Phone uses your mobile number from step 1.' },
];

/** Where each error key is shown, in page order (the first one gets focus). */
const ORDER = ['brandName', 'category', 'description', 'cityRef', 'instagram', 'website', 'logoUrl', 'contactMethods', 'whatsapp', 'mobile'] as const;
const FOCUS: Record<string, string> = {
  brandName: '[name="brandName"]', category: '[name="category"]', description: '[name="description"]', cityRef: 'input[name="city"]',
  instagram: '[name="instagram"]', website: '[name="website"]', logoUrl: '[data-field="logoUrl"]',
  contactMethods: '[data-method]', whatsapp: '[name="whatsapp"]', mobile: '[data-method]',
};

/** Builds the payload the API takes, or the same field errors the server would give. */
export function buildPayload(c: Craft, fullName: string, mobile: string) {
  const whatsapp = c.contactMethods.includes('whatsapp') ? (c.sameAsMobile ? mobile : c.whatsapp) : undefined;
  const res = validateOnboarding({
    fullName, mobile, brandName: c.brandName, category: c.category, description: c.description,
    cityRef: c.city?.ref, instagram: c.instagram, website: c.website, logoUrl: c.logoUrl,
    contactMethods: c.contactMethods, whatsapp,
  });
  return res.ok ? { ok: true as const, value: res.value } : { ok: false as const, errors: res.errors as FieldErrors };
}

export function StepCraft({ value, onChange, fullName, mobile, onBack, onSubmit, submitting = false }: {
  value: Craft;
  onChange: (patch: Partial<Craft>) => void;
  fullName: string;
  mobile: string;
  onBack: () => void;
  onSubmit: (payload: OnboardingInput) => void;
  submitting?: boolean;
}) {
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesDown, setCategoriesDown] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/categories')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('categories'))))
      .then((list: unknown) => { if (live && Array.isArray(list)) setCategories(list.filter((x): x is string => typeof x === 'string')); })
      .catch(() => { if (live) setCategoriesDown(true); });
    return () => { live = false; };
  }, []);

  // After the first Finish attempt the errors follow the fields live, so each one clears as soon as it is fixed.
  const result = buildPayload(value, fullName, mobile);
  const errors: FieldErrors = submitted && !result.ok ? result.errors : {};
  const err = (k: keyof FieldErrors) => errors[k];
  const bad = (k: keyof FieldErrors) => (errors[k] ? true : undefined);
  const desc = (k: keyof FieldErrors, ...extra: string[]) => [errors[k] ? `err-${k}` : '', ...extra].filter(Boolean).join(' ') || undefined;

  const waValue = value.sameAsMobile ? mobile : value.whatsapp;
  const toggle = (m: ContactMethod) => onChange({
    contactMethods: value.contactMethods.includes(m) ? value.contactMethods.filter(x => x !== m) : [...value.contactMethods, m],
  });
  const categoryOptions = value.category && !categories.includes(value.category) ? [value.category, ...categories] : categories;

  function finish(e: React.FormEvent) {
    e.preventDefault();
    if (logoBusy || submitting) return;
    setSubmitted(true);
    if (result.ok) { onSubmit(result.value); return; }
    const first = ORDER.find(k => result.errors[k]);
    const el = first ? formRef.current?.querySelector<HTMLElement>(FOCUS[first]) : null;
    el?.scrollIntoView?.({ block: 'center' });
    el?.focus();
  }

  return (
    <form ref={formRef} className="admin-form onboard-form" onSubmit={finish} noValidate>
      <h1>Tell customers about your craft</h1>
      <p className="onboard-lead">This is what people see on your public profile.</p>

      <label>
        <span className="lbl">Business or brand name</span>
        <input name="brandName" required maxLength={100} value={value.brandName} onChange={e => onChange({ brandName: e.target.value })}
          aria-invalid={bad('brandName')} aria-describedby={desc('brandName')} />
      </label>
      <FieldError id="err-brandName" message={err('brandName')} />

      <label>
        <span className="lbl">Category</span>
        <select name="category" required value={value.category} onChange={e => onChange({ category: e.target.value })}
          aria-invalid={bad('category')} aria-describedby={desc('category')}>
          <option value="">Choose a category</option>
          {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {categoriesDown && <small>Categories could not be loaded. Refresh the page to try again.</small>}
      </label>
      <FieldError id="err-category" message={err('category')} />

      <label>
        <span className="lbl">Short description</span>
        <textarea name="description" required rows={4} value={value.description} onChange={e => onChange({ description: e.target.value })}
          aria-invalid={bad('description')} aria-describedby={desc('description', 'hint-description')} />
      </label>
      <p className="onboard-counter" id="hint-description">
        <span>A line or two about what you make.</span>
        <span className={value.description.length > DESCRIPTION_MAX ? 'over' : undefined} aria-live="polite">{value.description.length} / {DESCRIPTION_MAX}</span>
      </p>
      <FieldError id="err-description" message={err('description')} />

      <div className="onboard-pair">
        <label>
          <span className="lbl">City</span>
          <CityInput required defaultRef={value.city ?? undefined} onPick={city => onChange({ city })}
            ariaInvalid={!!errors.cityRef} describedBy={desc('cityRef', 'hint-city')} />
        </label>
        <label>
          <span className="lbl">State</span>
          <input name="state" value={value.city?.state ?? ''} readOnly tabIndex={-1} placeholder="Fills in" />
        </label>
      </div>
      <p className="onboard-hint" id="hint-city">Start typing your city and pick it from the list. The state fills in for you.</p>
      <FieldError id="err-cityRef" message={err('cityRef')} />

      <h2 className="onboard-sub">Where can people see your work?</h2>
      <p className="onboard-hint">Add at least one.</p>
      <label>
        <span className="lbl">Instagram</span>
        <input name="instagram" autoCapitalize="none" maxLength={31} placeholder="@yourhandle" value={value.instagram} onChange={e => onChange({ instagram: e.target.value })}
          aria-invalid={bad('instagram')} aria-describedby={desc('instagram')} />
      </label>
      <FieldError id="err-instagram" message={err('instagram')} />
      <label>
        <span className="lbl">Website</span>
        <input name="website" type="url" inputMode="url" maxLength={200} placeholder="https://" value={value.website} onChange={e => onChange({ website: e.target.value })}
          aria-invalid={bad('website')} aria-describedby={desc('website')} />
      </label>
      <FieldError id="err-website" message={err('website')} />

      <h2 className="onboard-sub">Logo or profile photo <b className="onboard-req" aria-hidden="true">*</b></h2>
      <p className="onboard-hint">A square photo works best, at least 400 by 400.</p>
      <LogoUpload value={value.logoUrl} onChange={logoUrl => onChange({ logoUrl })} onBusyChange={setLogoBusy}
        invalid={!!errors.logoUrl} describedBy={desc('logoUrl')} />
      <FieldError id="err-logoUrl" message={err('logoUrl')} />

      <h2 className="onboard-sub" id="contact-heading">How should customers reach you? <b className="onboard-req" aria-hidden="true">*</b></h2>
      <p className="onboard-hint">Choose at least one. You can add more later.</p>
      <div className="onboard-toggles" role="group" aria-labelledby="contact-heading" aria-describedby={desc('contactMethods')}>
        {METHODS.map(m => {
          const on = value.contactMethods.includes(m.id);
          return (
            <button key={m.id} type="button" data-method={m.id} className={`onboard-toggle${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(m.id)}>
              {on && <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              {m.label}
            </button>
          );
        })}
      </div>
      <FieldError id="err-contactMethods" message={err('contactMethods')} />
      <FieldError id="err-mobile" message={err('mobile')} />
      {value.contactMethods.includes('whatsapp') && (
        <div className="onboard-panel">
          <label>
            <span className="lbl">WhatsApp number</span>
            <span className="onboard-mobile">
              <span className="onboard-prefix" aria-hidden="true">+91</span>
              <input name="whatsapp" type="tel" inputMode="numeric" autoComplete="off" maxLength={14} value={waValue} readOnly={value.sameAsMobile}
                onChange={e => onChange({ whatsapp: e.target.value })} aria-invalid={bad('whatsapp')} aria-describedby={desc('whatsapp')} />
            </span>
          </label>
          <FieldError id="err-whatsapp" message={err('whatsapp')} />
          <label className="onboard-check">
            <input type="checkbox" checked={value.sameAsMobile} onChange={e => onChange({ sameAsMobile: e.target.checked, ...(e.target.checked ? {} : { whatsapp: mobile }) })} />
            <span>Same as my mobile number</span>
          </label>
        </div>
      )}
      {METHODS.filter(m => m.note && value.contactMethods.includes(m.id)).map(m => (
        <p key={m.id} className="onboard-note">{m.note}</p>
      ))}

      <div className="onboard-actions">
        <button type="button" className="button" onClick={onBack}>Back</button>
        <button type="submit" className="button primary onboard-finish" disabled={logoBusy || submitting} aria-busy={logoBusy || submitting}>Finish and add my first product</button>
      </div>
    </form>
  );
}

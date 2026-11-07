'use client';
import { useEffect, useRef, useState } from 'react';
import { CityInput, type PickedCity } from '@/components/CityInput';
import { FieldError } from '@/components/onboarding/FieldError';
import { LogoUpload } from '@/components/onboarding/LogoUpload';
import { collapseSpaces } from '@/lib/category-name';
import { validateNewCategory, validateOnboarding, type FieldErrors, type OnboardingInput } from '@/lib/onboarding-validate';
import type { ContactMethod } from '@/lib/types';

export const DESCRIPTION_MAX = 200;
/** Select value for "Other (add a new category)"; never a real category name (the name rule rejects underscores). */
export const OTHER_CATEGORY = '__other__';

export type Craft = {
  brandName: string; category: string; newCategory: string; description: string; city: PickedCity | null;
  instagram: string; website: string; logoUrl: string;
  contactMethods: ContactMethod[]; sameAsMobile: boolean; whatsapp: string;
};
/** A stored draft may be malformed (older shape, edited storage): keep only well-typed fields. */
export function sanitizeCraft(raw: unknown): Craft {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
  const c = r.city && typeof r.city === 'object' ? r.city as Record<string, unknown> : null;
  const city = c && typeof c.ref === 'string' && typeof c.label === 'string' ? { ref: c.ref, label: c.label, ...(typeof c.state === 'string' && { state: c.state }) } : null;
  const methods = Array.isArray(r.contactMethods) ? METHOD_IDS.filter(m => (r.contactMethods as unknown[]).includes(m)) : [];
  return {
    brandName: str(r.brandName, ''), category: str(r.category, ''), newCategory: str(r.newCategory, '').slice(0, 100), description: str(r.description, ''), city,
    instagram: str(r.instagram, ''), website: str(r.website, ''), logoUrl: str(r.logoUrl, ''),
    contactMethods: methods, sameAsMobile: typeof r.sameAsMobile === 'boolean' ? r.sameAsMobile : true, whatsapp: str(r.whatsapp, ''),
  };
}

export const EMPTY_CRAFT: Craft = {
  brandName: '', category: '', newCategory: '', description: '', city: null, instagram: '', website: '', logoUrl: '',
  contactMethods: [], sameAsMobile: true, whatsapp: '',
};

const METHODS: { id: ContactMethod; label: string; note?: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram', note: 'Instagram uses the handle you entered above.' },
  { id: 'website', label: 'Website', note: 'Website uses the link you entered above.' },
  { id: 'phone', label: 'Phone', note: 'Phone uses your mobile number from step 1.' },
];

const METHOD_IDS = METHODS.map(m => m.id);

/** Where each error key is shown, in page order (the first one gets focus). */
const ORDER = ['brandName', 'category', 'description', 'cityRef', 'instagram', 'website', 'logoUrl', 'contactMethods', 'whatsapp', 'mobile'] as const;
const FOCUS: Record<string, string> = {
  brandName: '[name="brandName"]', category: '[name="category"]',  description: '[name="description"]', cityRef: 'input[name="city"]',
  instagram: '[name="instagram"]', website: '[name="website"]', logoUrl: '[data-field="logoUrl"]',
  contactMethods: '[data-method]', whatsapp: '[name="whatsapp"]', mobile: '[data-method]',
};

/**
 * Builds the payload the API takes, or the same field errors the server would give. With "Other" chosen the typed name
 * is the category: a name matching a known one (any case) submits that spelling, otherwise it must follow the name rule.
 */
export function buildPayload(c: Craft, fullName: string, mobile: string, known: string[] = []) {
  let category = c.category;
  let otherError: string | undefined;
  if (c.category === OTHER_CATEGORY) {
    const t = validateNewCategory(c.newCategory);
    if (t.ok) category = known.find(k => collapseSpaces(k).toLowerCase() === t.value.toLowerCase()) ?? t.value;
    else { category = ''; otherError = t.error; }
  }
  const whatsapp = c.contactMethods.includes('whatsapp') ? (c.sameAsMobile ? mobile : c.whatsapp) : undefined;
  const res = validateOnboarding({
    fullName, mobile, brandName: c.brandName, category, description: c.description,
    cityRef: c.city?.ref, instagram: c.instagram, website: c.website, logoUrl: c.logoUrl,
    contactMethods: c.contactMethods, whatsapp,
  });
  if (res.ok && !otherError) return { ok: true as const, value: res.value };
  const errors: FieldErrors = res.ok ? {} : res.errors;
  if (otherError) errors.category = otherError;
  return { ok: false as const, errors };
}

export function StepCraft({ value, onChange, fullName, mobile, onBack, onSubmit, submitting = false, serverErrors = {} }: {
  value: Craft;
  onChange: (patch: Partial<Craft>) => void;
  fullName: string;
  mobile: string;
  onBack: () => void;
  onSubmit: (payload: OnboardingInput) => void;
  submitting?: boolean;
  /** Field errors the server returned (422); they clear as soon as the seller edits anything. */
  serverErrors?: FieldErrors;
}) {
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesDown, setCategoriesDown] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const focusOther = useRef(false); // set when the maker just picked Other: the new input takes focus (not on a draft restore)
  const otherRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (value.category === OTHER_CATEGORY && focusOther.current) { focusOther.current = false; otherRef.current?.focus(); }
  }, [value.category]);

  useEffect(() => {
    let live = true;
    fetch('/api/categories')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('categories'))))
      .then((list: unknown) => { if (live && Array.isArray(list)) setCategories(list.filter((x): x is string => typeof x === 'string')); })
      .catch(() => { if (live) setCategoriesDown(true); });
    return () => { live = false; };
  }, []);

  // After the first Finish attempt the errors follow the fields live, so each one clears as soon as it is fixed.
  const result = buildPayload(value, fullName, mobile, categories);
  const errors: FieldErrors = { ...serverErrors, ...(submitted && !result.ok ? result.errors : {}) };
  const err = (k: keyof FieldErrors) => errors[k];
  const bad = (k: keyof FieldErrors) => (errors[k] ? true : undefined);
  const desc = (k: keyof FieldErrors, ...extra: string[]) => [errors[k] ? `err-${k}` : '', ...extra].filter(Boolean).join(' ') || undefined;

  const waValue = value.sameAsMobile ? mobile : value.whatsapp;
  const toggle = (m: ContactMethod) => onChange({
    contactMethods: value.contactMethods.includes(m) ? value.contactMethods.filter(x => x !== m) : [...value.contactMethods, m],
  });
  const isOther = value.category === OTHER_CATEGORY;
  const categoryOptions = value.category && !isOther && !categories.includes(value.category) ? [value.category, ...categories] : categories;

  // With Other chosen the category error is shown at the typed name, so that is where focus goes.
  const focusFor = (k: string) => (k === 'category' && isOther ? '[name="newCategory"]' : FOCUS[k]);

  // A new set of server errors: bring the first one into view.
  useEffect(() => {
    const first = ORDER.find(k => serverErrors[k]);
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(focusFor(first));
    el?.scrollIntoView?.({ block: 'center' });
    el?.focus();
  }, [serverErrors]);

  function finish(e: React.FormEvent) {
    e.preventDefault();
    if (logoBusy || submitting) return;
    setSubmitted(true);
    if (result.ok) { onSubmit(result.value); return; }
    const first = ORDER.find(k => result.errors[k]);
    const el = first ? formRef.current?.querySelector<HTMLElement>(focusFor(first)) : null;
    el?.scrollIntoView?.({ block: 'center' });
    el?.focus();
  }

  return (
    <form ref={formRef} className="admin-form onboard-form" onSubmit={finish} noValidate>
      <h1 tabIndex={-1}>Tell customers about your craft</h1>
      <p className="onboard-lead">This is what people see on your public profile.</p>

      <label>
        <span className="lbl">Business or brand name</span>
        <input name="brandName" required maxLength={100} value={value.brandName} onChange={e => onChange({ brandName: e.target.value })}
          aria-invalid={bad('brandName')} aria-describedby={desc('brandName')} />
      </label>
      <FieldError id="err-brandName" message={err('brandName')} />

      <label>
        <span className="lbl">Category</span>
        <select name="category" required value={value.category}
          onChange={e => { focusOther.current = e.target.value === OTHER_CATEGORY; onChange({ category: e.target.value }); }}
          aria-invalid={isOther ? undefined : bad('category')} aria-describedby={isOther ? undefined : desc('category')}>
          <option value="">Choose a category</option>
          {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          <option value={OTHER_CATEGORY}>Other (add a new category)</option>
        </select>
        {categoriesDown && <small>Categories could not be loaded. Refresh the page to try again.</small>}
      </label>
      {!isOther && <FieldError id="err-category" message={err('category')} />}
      {isOther && (
        <>
          <label>
            <span className="lbl">Your category</span>
            <input ref={otherRef} name="newCategory" required maxLength={100} value={value.newCategory} onChange={e => onChange({ newCategory: e.target.value })}
              aria-invalid={bad('category')} aria-describedby={desc('category', 'hint-newCategory')} />
          </label>
          <p className="onboard-hint" id="hint-newCategory">Tell us what you make</p>
          <FieldError id="err-category" message={err('category')} />
        </>
      )}

      <label>
        <span className="lbl">Short description</span>
        <textarea name="description" required rows={4} value={value.description} onChange={e => onChange({ description: e.target.value })}
          aria-invalid={bad('description')} aria-describedby={desc('description', 'hint-description')} />
      </label>
      <p className="onboard-counter" id="hint-description">
        <span>A line or two about what you make.</span>
        <span className={value.description.length > DESCRIPTION_MAX ? 'over' : undefined} data-testid="description-counter">{value.description.length} / {DESCRIPTION_MAX}</span>
      </p>
      {/* Only the over-limit state is announced, once: the text is constant, so further keystrokes do not re-announce it. */}
      {value.description.length > DESCRIPTION_MAX && <span className="sr-only" role="status">Description is over {DESCRIPTION_MAX} characters.</span>}
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

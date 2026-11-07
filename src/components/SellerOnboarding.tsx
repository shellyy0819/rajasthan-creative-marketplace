'use client';
import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { FieldError } from '@/components/onboarding/FieldError';
import { EMPTY_CRAFT, StepCraft, sanitizeCraft, type Craft } from '@/components/onboarding/StepCraft';
import { OnboardingDone } from '@/components/onboarding/OnboardingDone';
import { validateFullName, validateMobile, type FieldErrors, type OnboardingInput } from '@/lib/onboarding-validate';

export type SellerOnboardingProps = {
  initialName: string; initialEmail: string; postsUrl: string; postsUrlNew: string;
  /** Test seam: when given, Finish hands the validated payload to it instead of calling the API. */
  onSubmit?: (payload: OnboardingInput) => void;
};

export const DRAFT_KEY = 'craftofy.onboarding';
export type Draft = { email?: string; step: 1 | 2; fullName?: string; mobile?: string; craft?: Craft };

export function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch { return null; }
}
export function saveDraft(d: Draft) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage blocked: the draft just is not kept */ }
}

type Errors = { fullName?: string; mobile?: string; craft?: Craft };

const STEP1_KEYS = ['fullName', 'mobile'];
const STEP2_KEYS = ['brandName', 'category', 'description', 'cityRef', 'instagram', 'website', 'logoUrl', 'contactMethods', 'whatsapp'];
const RETRY = 'Something went wrong. Please try again.';

export function SellerOnboarding({ initialName, initialEmail, postsUrl, postsUrlNew, onSubmit }: SellerOnboardingProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState(initialName);
  const [mobile, setMobile] = useState('');
  const [craft, setCraftState] = useState<Craft>(EMPTY_CRAFT);
  const craftRef = useRef<Craft>(EMPTY_CRAFT); // latest value: an upload finishing later must not overwrite newer typing
  const setCraft = (c: Craft) => { craftRef.current = c; setCraftState(c); };
  const [errors, setErrors] = useState<Errors>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const touched = useRef(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const [done, setDone] = useState<{ name: string; brand: string } | null>(null);

  // Restore once on mount. Idempotent (safe under StrictMode double-effects): it only reads, never writes, and
  // skips a draft from another account or anything the user has already typed.
  useEffect(() => {
    if (touched.current) return;
    const d = loadDraft();
    if (touched.current || !d || d.email !== initialEmail) return; // re-check: an edit may land while the draft is being read
    if (typeof d.fullName === 'string') setFullName(d.fullName);
    if (typeof d.mobile === 'string') setMobile(d.mobile);
    if (d.craft !== undefined) setCraft(sanitizeCraft(d.craft));
    if (d.step === 2) setStep(2);
  }, [initialEmail]);

  // Drafts are written from event handlers only, never from an effect.
  function persist(patch: Partial<Draft>) {
    touched.current = true;
    setServerErrors(e => (Object.keys(e).length ? {} : e));
    setNotice('');
    saveDraft({ email: initialEmail, step, fullName, mobile, craft: craftRef.current, ...patch });
  }

  const nameError = (v: string) => { const r = validateFullName(v); return r.ok ? undefined : r.error; };
  const mobileError = (v: string) => { const r = validateMobile(v); return r.ok ? undefined : r.error; };

  function onName(v: string) {
    setFullName(v);
    persist({ fullName: v });
    if (errors.fullName && !nameError(v)) setErrors(e => ({ ...e, fullName: undefined }));
  }
  function onMobile(v: string) {
    setMobile(v);
    persist({ mobile: v });
    if (errors.mobile && !mobileError(v)) setErrors(e => ({ ...e, mobile: undefined }));
  }
  function onCraft(patch: Partial<Craft>) {
    const merged = { ...craftRef.current, ...patch };
    setCraft(merged);
    persist({ craft: merged });
  }
  async function submit(payload: OnboardingInput) {
    if (onSubmit) { onSubmit(payload); return; }
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setNotice('');
    try {
      let res: Response;
      try {
        res = await fetch('/api/onboarding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      } catch { setNotice('We could not reach Craftofy. Check your connection and try again.'); return; }
      let body: { errors?: unknown; error?: unknown } | null = null;
      try { body = await res.json(); } catch { /* not JSON */ }
      if (res.status === 200 && body) {
        try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* storage blocked */ }
        setDone({ name: payload.fullName.trim().split(/\s+/)[0] || payload.fullName, brand: payload.brandName });
        return;
      }
      if (res.status === 422 && body && body.errors && typeof body.errors === 'object') {
        applyServerErrors(body.errors as FieldErrors);
      } else if (res.status === 401) {
        void signIn('google', { callbackUrl: '/sell' }); // the draft stays in sessionStorage
        setNotice('Your session ended. Taking you to sign in again.');
      } else if (res.status === 403) {
        setNotice(typeof body?.error === 'string' && body.error ? body.error : 'This account cannot sell on Craftofy.');
      } else if (res.status === 429) {
        setNotice('Too many attempts. Please wait a minute and try again.');
      } else {
        setNotice(RETRY);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }
  function applyServerErrors(errs: FieldErrors) {
    const clean: FieldErrors = {};
    const loose: string[] = [];
    for (const [k, v] of Object.entries(errs)) {
      if (typeof v !== 'string' || !v) continue;
      if (STEP1_KEYS.includes(k) || STEP2_KEYS.includes(k)) clean[k as keyof FieldErrors] = v;
      else loose.push(v); // e.g. `form` or an unknown key: no field to hang it on, so say it at the top
    }
    setServerErrors(clean);
    setNotice(loose.join(' '));
    if (clean.fullName || clean.mobile) {
      setErrors({ fullName: clean.fullName, mobile: clean.mobile });
      setStep(1);
      saveDraft({ email: initialEmail, step: 1, fullName, mobile, craft: craftRef.current }); // not persist(): that would clear the errors just set
    } else if (!Object.keys(clean).length && !loose.length) setNotice(RETRY);
  }
  function next(e: React.FormEvent) {
    e.preventDefault();
    const errs: Errors = { fullName: nameError(fullName), mobile: mobileError(mobile) };
    setErrors(errs);
    if (errs.fullName) { nameRef.current?.scrollIntoView?.({ block: 'center' }); nameRef.current?.focus(); return; }
    if (errs.mobile) { mobileRef.current?.scrollIntoView?.({ block: 'center' }); mobileRef.current?.focus(); return; }
    setStep(2);
    persist({ step: 2 });
  }

  if (done) return <section className="onboard-wrap"><div className="onboard-card"><OnboardingDone name={done.name} brand={done.brand} postsUrl={postsUrl} postsUrlNew={postsUrlNew} /></div></section>;

  return (
    <section className="onboard-wrap">
      <div className="onboard-card">
        <p className="onboard-step" aria-live="polite">Step {step} of 2: {step === 1 ? 'You' : 'Your craft'}</p>
        {notice && <p className="onboard-banner" role="alert">{notice}</p>}
        {step === 1 ? (
          <form className="admin-form onboard-form" onSubmit={next} noValidate>
            <h1>Tell us about you</h1>
            <p className="onboard-lead">We took your name and email from Google. Add a mobile number so Craftofy can reach you.</p>
            <label>
              <span className="lbl">Full name</span>
              <input ref={nameRef} name="fullName" required maxLength={100} autoComplete="name" value={fullName} onChange={e => onName(e.target.value)}
                aria-invalid={errors.fullName ? true : undefined} aria-describedby={errors.fullName ? 'err-fullName' : undefined} />
            </label>
            <FieldError id="err-fullName" message={errors.fullName} />
            <label>
              <span className="lbl">Email address</span>
              <input name="email" type="email" value={initialEmail} readOnly />
              <small className="onboard-verified">Verified by Google</small>
            </label>
            <label>
              <span className="lbl">Mobile number</span>
              <span className="onboard-mobile">
                <span className="onboard-prefix" aria-hidden="true">+91</span>
                <input ref={mobileRef} name="mobile" type="tel" required inputMode="numeric" autoComplete="tel-national" maxLength={14} value={mobile} onChange={e => onMobile(e.target.value)}
                  aria-invalid={errors.mobile ? true : undefined} aria-describedby={errors.mobile ? 'err-mobile hint-mobile' : 'hint-mobile'} />
              </span>
            </label>
            <FieldError id="err-mobile" message={errors.mobile} />
            <p className="onboard-hint" id="hint-mobile">10-digit mobile number. We do not send a code. Customers do not see it unless you choose Phone as a contact method.</p>
            <button type="submit" className="button primary onboard-cta">Continue</button>
          </form>
        ) : (
          <StepCraft value={craft} onChange={onCraft} fullName={fullName} mobile={mobile}
            onBack={() => { setStep(1); persist({ step: 1 }); }} onSubmit={p => void submit(p)} submitting={submitting} serverErrors={serverErrors} />
        )}
      </div>
    </section>
  );
}

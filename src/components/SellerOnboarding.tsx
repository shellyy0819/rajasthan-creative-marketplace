'use client';
import { useEffect, useRef, useState } from 'react';
import { FieldError } from '@/components/onboarding/FieldError';
import { validateFullName, validateMobile } from '@/lib/onboarding-validate';

export type SellerOnboardingProps = { initialName: string; initialEmail: string; postsUrl: string; postsUrlNew: string };

export const DRAFT_KEY = 'craftofy.onboarding';
export type Draft = { email?: string; step: 1 | 2; fullName?: string; mobile?: string };

export function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch { return null; }
}
export function saveDraft(d: Draft) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage blocked: the draft just is not kept */ }
}

type Errors = { fullName?: string; mobile?: string };

export function SellerOnboarding({ initialName, initialEmail }: SellerOnboardingProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState(initialName);
  const [mobile, setMobile] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const touched = useRef(false);

  // Restore once on mount. Idempotent (safe under StrictMode double-effects): it only reads, never writes, and
  // skips a draft from another account or anything the user has already typed.
  useEffect(() => {
    if (touched.current) return;
    const d = loadDraft();
    if (touched.current || !d || d.email !== initialEmail) return; // re-check: an edit may land while the draft is being read
    if (typeof d.fullName === 'string') setFullName(d.fullName);
    if (typeof d.mobile === 'string') setMobile(d.mobile);
    if (d.step === 2) setStep(2);
  }, [initialEmail]);

  // Drafts are written from event handlers only, never from an effect.
  function persist(patch: Partial<Draft>) {
    touched.current = true;
    saveDraft({ email: initialEmail, step, fullName, mobile, ...patch });
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
  function next(e: React.FormEvent) {
    e.preventDefault();
    const errs: Errors = { fullName: nameError(fullName), mobile: mobileError(mobile) };
    setErrors(errs);
    if (errs.fullName) { nameRef.current?.scrollIntoView?.({ block: 'center' }); nameRef.current?.focus(); return; }
    if (errs.mobile) { mobileRef.current?.scrollIntoView?.({ block: 'center' }); mobileRef.current?.focus(); return; }
    setStep(2);
    persist({ step: 2 });
  }

  return (
    <section className="onboard-wrap">
      <div className="onboard-card">
        <p className="onboard-step" aria-live="polite">Step {step} of 2: {step === 1 ? 'You' : 'Your craft'}</p>
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
          <div>
            <h1>Tell us about your craft</h1>
            <p className="onboard-lead">Step 2 coming in Task 7</p>
            <button type="button" className="button" onClick={() => { setStep(1); persist({ step: 1 }); }}>Back</button>
          </div>
        )}
      </div>
    </section>
  );
}

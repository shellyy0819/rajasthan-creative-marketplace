'use client';
import { useEffect, useRef, useState } from 'react';
import { FieldError } from '@/components/onboarding/FieldError';
import { EMPTY_CRAFT, StepCraft, type Craft } from '@/components/onboarding/StepCraft';
import { validateFullName, validateMobile, type OnboardingInput } from '@/lib/onboarding-validate';

export type SellerOnboardingProps = {
  initialName: string; initialEmail: string; postsUrl: string; postsUrlNew: string;
  /** Called with the validated payload when the seller finishes (the API call is wired by the caller). */
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

export function SellerOnboarding({ initialName, initialEmail, onSubmit }: SellerOnboardingProps) {
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

  // Restore once on mount. Idempotent (safe under StrictMode double-effects): it only reads, never writes, and
  // skips a draft from another account or anything the user has already typed.
  useEffect(() => {
    if (touched.current) return;
    const d = loadDraft();
    if (touched.current || !d || d.email !== initialEmail) return; // re-check: an edit may land while the draft is being read
    if (typeof d.fullName === 'string') setFullName(d.fullName);
    if (typeof d.mobile === 'string') setMobile(d.mobile);
    if (d.craft && typeof d.craft === 'object') setCraft({ ...EMPTY_CRAFT, ...d.craft });
    if (d.step === 2) setStep(2);
  }, [initialEmail]);

  // Drafts are written from event handlers only, never from an effect.
  function persist(patch: Partial<Draft>) {
    touched.current = true;
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
          <StepCraft value={craft} onChange={onCraft} fullName={fullName} mobile={mobile}
            onBack={() => { setStep(1); persist({ step: 1 }); }} onSubmit={p => onSubmit?.(p)} />
        )}
      </div>
    </section>
  );
}

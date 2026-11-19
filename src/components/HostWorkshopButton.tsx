'use client';
import { RequestReceived, type RequestDone } from '@/components/RequestReceived';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageUploader } from './ImageUploader';
import { PHONE_HINT, PHONE_PATTERN } from '@/lib/phone';
import { DEFAULT_CONTACT_EMAIL } from '@/lib/site';
import { MAX_REQUEST_IMAGES, submitErrorMessage } from '@/lib/workshop-requests-shared';
import { HOST_PARAM, LEGACY_HOST_PARAM, HOST_OPEN_EVENT, hostParamFor, type HostOpenDetail, type HostPath } from '@/lib/host-link';
import { supportLine } from '@/lib/workshop-support';
import { clearDraft, collectDraft, DRAFT_EVENT, hasContent, readDraft, writeDraft, type HostDraft } from '@/lib/host-draft';
import { CONTINUE_EVENT } from './HostDraftReminder';
import type { TopicOption } from '@/lib/topics';
import { fieldErrorFromMessage } from '@/lib/field-errors';
import { JOIN_LINK_HINT, validJoinLink } from '@/lib/join-link';
import { useFieldErrors } from './useFieldErrors';
import { activePriceRows, BLANK_PRICE, ClassAbout, craftFields, EventAbout, FieldError, ClassWhenAndPrice, DURATION_ERROR, durationMinutes, durationValid, EventWhereWhen, InstagramField, PRICE_ROW_ERROR, priceRowsIncomplete, type PriceDraft } from './HostListingFields';
import './HostWorkshopStepper.css';
import './WorkshopListings.css';

const STEPS = ['The event', 'When and where', 'About you'];
const LAST = STEPS.length - 1;
const field = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * "Host a workshop": opens a form that collects every detail we need to list a workshop, meetup, pop-up or flea market.
 * `defaultOpen` opens it on first render (a shared ?host= link); `shareable` keeps ?type=in-person (or online) in the address bar while it is open.
 */
export function HostWorkshopButton({ className = 'button outline', contactEmail = DEFAULT_CONTACT_EMAIL, defaultOpen = false, shareable = false, path: preset = 'event', initialPath, topics = [], label = 'Host a workshop', prefill = false, saveDraft = false, reminderTarget = false }: {
  className?: string; contactEmail?: string; defaultOpen?: boolean; shareable?: boolean;
  /** The path a click on the button starts on. */
  path?: HostPath;
  /** The path a shared link opens on (null: no choice yet). Defaults to `path`. */
  initialPath?: HostPath | null;
  topics?: TopicOption[]; label?: string;
  /** Fill the form from the signed-in person's own details (name, email and, for sellers, their profile). */
  prefill?: boolean;
  /** Save what is typed in this browser so the visitor can come back to it (cleared once the details are sent). */
  saveDraft?: boolean;
  /** This button opens the draft when the page's reminder modal says Continue (one button per page). */
  reminderTarget?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [path, setPath] = useState<HostPath | null>(defaultOpen && initialPath !== undefined ? initialPath : preset);
  const [priceRows, setPriceRows] = useState<PriceDraft[]>([{ ...BLANK_PRICE }]); // one plan open by default
  const [repeat, setRepeat] = useState<'weekly' | 'monthly'>('weekly');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [uploading, setUploading] = useState(false);
  // After the details are sent, the emailed code must be confirmed before the request counts.
  const [pending, setPending] = useState<{ id: string; name: string; email: string; from: string; to: string } | null>(null);
  const [info, setInfo] = useState('');
  const [wait, setWait] = useState(0); // seconds until another code may be requested
  const [done, setDone] = useState<RequestDone | null>(null);
  const [step, setStep] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const shownStep = useRef(0);
  const { errors: fieldErrors, show: showFieldError, clear: clearFieldError, clearAll: clearFieldErrors } = useFieldErrors(formRef, setStep);
  /** Show a message under its field (and go to it); a message about no field of this form goes in the banner. */
  const fail = (name: string, text: string) => { if (!showFieldError(name, text)) setError(text); return false; };
  const me = useRef<Record<string, string>>({});
  const [meTick, setMeTick] = useState(0);
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [imagesKey, setImagesKey] = useState(0);
  const [restored, setRestored] = useState(false);
  const restore = useRef<HostDraft | null>(null);
  const applied = useRef(new Set<string>());
  const [restoreTick, setRestoreTick] = useState(0);
  // An unfinished draft from an earlier visit (read in the browser only): the button offers to continue it.
  const [existing, setExisting] = useState<HostDraft | null>(null);
  useEffect(() => {
    if (!saveDraft) return;
    const read = () => { const d = readDraft(); setExisting(d && hasContent(d) ? d : null); };
    read();
    window.addEventListener(DRAFT_EVENT, read);
    return () => window.removeEventListener(DRAFT_EVENT, read);
  }, [saveDraft, open, done, pending]);
  const latest = useRef({ path, step: 0, startDate: '', paid: false, repeat: 'weekly' as 'weekly' | 'monthly', priceRows: [] as PriceDraft[] });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The form is portalled into document.body, which does not exist while rendering on the server (a ?host=1 link opens it on first render).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  latest.current = { path, step, startDate, paid, repeat, priceRows };
  const saveNow = () => {
    if (!saveDraft || !formRef.current || done || pending) return;
    const d = collectDraft(formRef.current, latest.current);
    if (hasContent(d)) writeDraft(d); else clearDraft(); // nothing typed: nothing to keep or to remind about
  };
  const scheduleSave = () => {
    if (!saveDraft) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveNow, 400);
  };
  useEffect(() => { clearFieldError('prices'); }, [priceRows]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) scheduleSave(); }, [path, step, startDate, paid, repeat, priceRows, open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  /** Bring back the saved draft when it belongs to the path being opened (a link that asks for the other path starts clean). */
  function restoreDraft(startPath: HostPath | null) {
    const d = saveDraft ? readDraft() : null;
    restore.current = null; applied.current = new Set(); setRestored(false); setDraftImages([]);
    if (!d || (startPath !== null && d.path !== startPath)) return;
    restore.current = d;
    setPath(d.path); setStep(Math.min(Math.max(d.step, 0), 2)); setStartDate(d.startDate); setPaid(d.paid); setRepeat(d.repeat); setPriceRows(d.priceRows.length ? d.priceRows : [{ ...BLANK_PRICE }]);
    setDraftImages(d.images); setImagesKey(k => k + 1); setRestored(true); setRestoreTick(t => t + 1);
  }
  // A shared link opens the form on first render: restore there too (browser only).
  useEffect(() => { if (defaultOpen) restoreDraft(initialPath === undefined ? preset : initialPath); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Put the saved values into the fields once they exist (fields of the other path or step appear later).
  useEffect(() => {
    const form = formRef.current, d = restore.current;
    if (!form || !d) return;
    for (const [name, v] of Object.entries(d.fields)) {
      const el = form.elements.namedItem(name);
      if (!applied.current.has(name) && (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) { el.value = v; el.dispatchEvent(new Event('rr-sync')); applied.current.add(name); }
    }
    const days = form.querySelectorAll<HTMLInputElement>('input[name="days"]');
    if (days.length && !applied.current.has('days')) { days.forEach(c => { c.checked = d.days.includes(c.value); }); applied.current.add('days'); }
    const weeks = form.querySelectorAll<HTMLInputElement>('input[name="weeks"]');
    if (weeks.length && !applied.current.has('weeks')) { weeks.forEach(c => { c.checked = d.weeks.includes(c.value); }); applied.current.add('weeks'); }
    const trial = form.elements.namedItem('freeTrial');
    if (trial instanceof HTMLInputElement && !applied.current.has('freeTrial')) { trial.checked = d.freeTrial; applied.current.add('freeTrial'); }
  }, [restoreTick, path, repeat, paid, step, open, mounted]);

  function startOver() {
    clearDraft(); restore.current = null; applied.current = new Set();
    formRef.current?.reset();
    setStep(0); setStartDate(''); setPaid(false); setRepeat('weekly'); setPriceRows([{ ...BLANK_PRICE }]); setDraftImages([]); setImagesKey(k => k + 1); setRestored(false);
  }

  /** Open the form from the button (or from the reminder's Continue). With an unfinished draft it continues that draft, whichever path it was on. */
  function begin(from?: HostPath) {
    setError(''); setDone(null); setPaid(false); setStartDate(''); setUploading(false); setPending(null); setInfo(''); setWait(0); setStep(0); setPath(from ?? preset); setPriceRows([{ ...BLANK_PRICE }]); setRepeat('weekly');
    // A link that asks for a path starts on it (a draft on the other path is not forced on it); the plain button continues any draft.
    restoreDraft(from ? from : existing || readDraft() ? null : preset);
    setOpen(true);
  }
  const beginRef = useRef(begin);
  beginRef.current = begin;
  useEffect(() => {
    if (!reminderTarget) return;
    const go = () => beginRef.current();
    // The footer's host links on this page: open on the path they ask for, every time, without leaving the page.
    const openFor = (e: Event) => beginRef.current((e as CustomEvent<HostOpenDetail>).detail?.path);
    window.addEventListener(CONTINUE_EVENT, go);
    window.addEventListener(HOST_OPEN_EVENT, openFor);
    return () => { window.removeEventListener(CONTINUE_EVENT, go); window.removeEventListener(HOST_OPEN_EVENT, openFor); };
  }, [reminderTarget]);

  const close = () => { saveNow(); setOpen(false); trigger.current?.focus(); };
  // Opening puts focus on the dialog itself, not on a field: no cursor in the title and no keyboard popping up on a phone.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open && mounted) dialogRef.current?.focus({ preventScroll: true }); }, [open, mounted]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, sending]);

  // Mirror the open form in the address bar so the link can be copied and shared. replaceState: no history entry, no server round trip.
  const hostValue = hostParamFor(path);
  const ownsParam = useRef(false); // only the button that wrote the address-bar value takes it away again (two buttons on one page)
  useEffect(() => {
    if (!shareable) return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get(HOST_PARAM);
    if (open) {
      if (current === 'FREE' || current === 'PAID') return; // a price filter is in the address bar: leave it alone
      ownsParam.current = true;
      if (current === hostValue && !url.searchParams.has(LEGACY_HOST_PARAM)) return;
      url.searchParams.delete(LEGACY_HOST_PARAM);
      url.searchParams.set(HOST_PARAM, hostValue);
    } else {
      if (!ownsParam.current) return;
      ownsParam.current = false;
      if (current !== 'in-person' && current !== 'online') return;
      url.searchParams.delete(HOST_PARAM);
    }
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, [open, shareable, hostValue]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  /** One POST to the workshop API. On failure `error` is the message to show the visitor. */
  async function post(url: string, body: unknown): Promise<{ ok: boolean; data: { id?: string; email?: string; status?: string; notified?: boolean } | null; error: string }> {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => null);
      return { ok: r.ok, data, error: r.ok ? '' : submitErrorMessage(r.status, data?.error, contactEmail) };
    } catch { return { ok: false, data: null, error: submitErrorMessage(0, null, contactEmail) }; }
  }

  /** The inputs of one step. Inactive steps stay in the form (hidden), so nothing typed is lost and all of it is sent. */
  const stepFields = (i: number) => Array.from(formRef.current?.querySelectorAll<HTMLInputElement>(`[data-step="${i}"] input, [data-step="${i}"] select, [data-step="${i}"] textarea`) ?? []);
  /** The form has no native validation (a hidden step cannot show its bubble), so each step checks its own fields before moving on. */
  function stepValid(i: number) {
    const bad = stepFields(i).find(el => !el.checkValidity());
    bad?.reportValidity();
    if (bad) return false;
    if (i === 1 && path === 'class') {
      const val = (n: string) => stepFields(1).find(el => el.name === n)?.value ?? '';
      const link = val('joinLink').trim();
      if (link && !validJoinLink(link)) return fail('joinLink', `That is not a valid meeting link. ${JOIN_LINK_HINT}`);
      if (!stepFields(1).some(el => el.name === 'days' && el.checked)) return fail('days', 'Choose at least one class day.');
      if (repeat === 'monthly' && !stepFields(1).some(el => el.name === 'weeks' && el.checked)) return fail('weeks', 'Choose at least one week of the month.');
      if (!durationValid(durationMinutes(val('durationValue'), val('durationUnit')))) return fail('durationValue', DURATION_ERROR);
      if (priceRowsIncomplete(priceRows)) return fail('prices', PRICE_ROW_ERROR);
    }
    return true;
  }
  function back() { setError(''); clearFieldErrors(); setStep(s => Math.max(0, s - 1)); }
  // Signed in: fetch the person's own details the first time the form opens (later openings on this page reuse them, so opening is free), then fill empty fields (never over what they typed).
  const prefillLoaded = useRef(false);
  useEffect(() => {
    if (!prefill || !open || prefillLoaded.current) return;
    let live = true;
    fetch('/api/host-prefill', { cache: 'no-store' }).then(r => (r?.ok ? r.json() : {})).then((d: Record<string, string>) => {
      if (d && typeof d === 'object') { prefillLoaded.current = true; me.current = d; if (live) setMeTick(t => t + 1); }
    }).catch(() => {});
    return () => { live = false; };
  }, [prefill, open]);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const map: Record<string, string | undefined> = { contactName: me.current.name, email: me.current.email, hostName: me.current.hostName, phone: me.current.phone, whatsapp: me.current.whatsapp, instagram: me.current.instagram, website: me.current.website };
    for (const [name, value] of Object.entries(map)) {
      const el = form.elements.namedItem(name);
      if (value && el instanceof HTMLInputElement && !el.value) el.value = value;
    }
  }, [meTick, path, open, step]);

  // Landing on another step: scroll the dialog to the top and focus its first field.
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    const root = formRef.current;
    root?.scrollTo?.(0, 0);
    if (!Object.keys(fieldErrors).length) root?.querySelector<HTMLElement>(`[data-step="${step}"] :is(input:not([type="hidden"]), select, textarea)`)?.focus(); // a message under a field has already taken focus there
  }, [step]);

  /** Next on steps 1 and 2 (also Enter), Send details on the last one. */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending || !stepValid(step)) return;
    if (step < LAST) { setError(''); setStep(step + 1); return; }
    void sendDetails(new FormData(e.currentTarget));
  }

  async function sendDetails(f: FormData) {
    setSending(true); setError('');
    const isClass = path === 'class';
    const topicId = field(f, 'topicId') ? Number(field(f, 'topicId')) : undefined;
    const common = {
      hostName: field(f, 'hostName'), contactName: field(f, 'contactName'), phone: field(f, 'phone'), phonePublic: f.get('phonePublic') === 'on', email: field(f, 'email'),
      title: field(f, 'title'), description: field(f, 'description'), topicId, startDate: field(f, 'startDate'),
      instagram: field(f, 'instagram'), website: field(f, 'website'), notes: field(f, 'notes'), images: f.getAll('images').map(v => String(v).trim()).filter(Boolean), companyWebsite: field(f, 'companyWebsite'),
    };
    const body = isClass ? {
      ...common, mode: 'online', kind: 'class', platform: field(f, 'platform'), joinLink: field(f, 'joinLink') || undefined, endsOn: field(f, 'endsOn') || field(f, 'startDate'), // no end date: the classes end on the start date
     
      schedule: { repeat, days: f.getAll('days').map(String), ...(repeat === 'monthly' ? { weeks: f.getAll('weeks').map(w => (w === 'last' ? 'last' : Number(w))) } : {}), time: field(f, 'classTime'), durationMin: durationMinutes(field(f, 'durationValue'), field(f, 'durationUnit')) },
      prices: activePriceRows(priceRows).map(r => ({ label: r.label.trim(), amountPaise: Math.round(Number(r.amount) * 100), sessions: r.sessions ? Number(r.sessions) : null })),
      freeTrial: !!field(f, 'freeTrialDays'), freeTrialDays: field(f, 'freeTrialDays') ? Number(field(f, 'freeTrialDays')) : undefined, languages: field(f, 'languages').split(',').map(x => x.trim()).filter(Boolean),
      level: field(f, 'level') || undefined, experience: field(f, 'experience') || undefined, certifications: field(f, 'certifications') || undefined, whatsapp: field(f, 'whatsapp') || undefined,
    } : {
      ...common, mode: 'in_person', kind: field(f, 'kind'), cityRef: field(f, 'cityRef'), venue: field(f, 'venue'),
      endDate: field(f, 'endDate'), startTime: field(f, 'startTime'), endTime: field(f, 'endTime'),
      seats: field(f, 'seats') ? Number(field(f, 'seats')) : undefined,
      priceType: paid ? 'PAID' : 'FREE', priceRupees: paid ? Number(field(f, 'priceRupees')) : undefined,
      ...craftFields(f),
    };
    const lastDate = isClass ? field(f, 'endsOn') : field(f, 'endDate');
    try {
      const { ok, data, error } = await post('/api/workshop-requests', body);
      if (!ok || !data) {
        const text = error || submitErrorMessage(0, null, contactEmail);
        const f = fieldErrorFromMessage(text);
        if (!(f && showFieldError(f.name, f.text))) setError(text); // a message about a field goes under it; anything else in the banner
        setSending(false); return;
      }
      const summary = { name: body.contactName, email: data.email ?? body.email, from: fmtDate(body.startDate), to: fmtDate(lastDate || body.startDate) };
      clearDraft();
      if (data.status === 'received') { setDone({ ...summary, confirmed: false, notified: false }); setSending(false); return; } // the code email could not be sent; we still have the details
      setPending({ id: data.id ?? '', ...summary });
      setWait(60); setSending(false);
    } catch { setError(submitErrorMessage(0, null, contactEmail)); setSending(false); }
  }

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending || !pending) return;
    setSending(true); setError(''); setInfo('');
    const { ok, data, error } = await post('/api/workshop-requests/verify', { id: pending.id, code: field(new FormData(e.currentTarget), 'code') });
    if (!ok) { setError(error); setSending(false); return; }
    setDone({ name: pending.name, email: pending.email, from: pending.from, to: pending.to, confirmed: true, notified: data?.notified === true }); setPending(null); setSending(false);
  }

  async function resend() {
    if (sending || wait > 0 || !pending) return;
    setSending(true); setError(''); setInfo('');
    const { ok, error } = await post('/api/workshop-requests/resend', { id: pending.id });
    if (!ok) setError(error);
    else { setInfo(`We sent a new code to ${pending.email}.`); setWait(60); }
    setSending(false);
  }

  return (
    <>
      <button ref={trigger} type="button" className={className} aria-haspopup="dialog" onClick={() => begin()}>{existing ? 'Continue your listing' : label} <span>↗</span></button>
      {open && mounted && createPortal(
        <div className="contact-backdrop admin-modal host-backdrop" onClick={e => { if (e.target === e.currentTarget && !sending) close(); }}>
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="host-title" className={`contact-card host-dialog${!done && !pending ? ' host-dialog-form' : ''}`}>
            <div className="dialog-head">
              <h2 id="host-title">{done ? 'Welcome to Craftofy' : pending ? 'Please verify your email' : path === 'class' ? 'Teach an online class' : 'Host a workshop or pop-up'}</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={close} disabled={sending}>✕</button>
            </div>
            {done ? (
              <RequestReceived done={done} onClose={close} />
            ) : pending ? (
              <form className="admin-form" onSubmit={verify}>
                <p className="form-note">We sent a 6-digit code to {pending.email}. It is valid for 10 minutes.</p>
                {error && <p role="alert" className="admin-error">{error}</p>}
                {info && <p role="status" className="form-note">{info}</p>}
                <label><span className="lbl">Code from the email</span>
                  <input name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" title="Enter the 6 digits from the email." autoFocus />
                </label>
                <div className="admin-actions">
                  <button type="button" className="button" onClick={resend} disabled={sending || wait > 0}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button>
                  <button type="submit" className="button primary" disabled={sending} aria-busy={sending}>{sending ? 'Checking…' : 'Verify'}</button>
                </div>
              </form>
            ) : (
              <>
              <div className="host-progress">
                  <ol className="host-steps" aria-label="Progress">
                    {STEPS.map((name, i) => <li key={name} className={i < step ? 'done' : undefined} aria-current={i === step ? 'step' : undefined}><span className="host-step-label">{name}</span></li>)}
                  </ol>
                  <p className="host-step-count">Step {step + 1} of {STEPS.length}</p>
                </div>
              <form ref={formRef} className="admin-form host-form" noValidate onSubmit={onSubmit} onInput={e => { const n = (e.target as HTMLInputElement).name; if (n) clearFieldError(n); scheduleSave(); }} onChange={e => { const n = (e.target as unknown as HTMLInputElement).name; if (n) clearFieldError(n); scheduleSave(); }}>
                {error && <p role="alert" className="admin-error">{error}</p>}
                <div className="host-step" data-step={0} hidden={step !== 0}>
                  <p className="form-note">{supportLine()}</p>
                  <fieldset className="host-path">
                    <legend>What are you hosting?</legend>
                    <div className="host-path-cards">
                      <label className="host-path-card"><input type="radio" name="path" value="event" aria-label="In-person event" required checked={path === 'event'} onChange={() => setPath('event')} /><span><b>In-person event</b><small>Workshop, meetup, pop-up or flea market</small></span></label>
                      <label className="host-path-card"><input type="radio" name="path" value="class" aria-label="Online class" required checked={path === 'class'} onChange={() => setPath('class')} /><span><b>Online class</b><small>Regular classes on Zoom, Google Meet…</small></span></label>
                    </div>
                  </fieldset>
                  <label>Topic
                    <select name="topicId" defaultValue="">
                      <option value="">Other</option>
                      {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                  <label><span className="lbl">{path === 'class' ? 'Class title' : 'Event title'}</span><input name="title" required maxLength={150} autoCapitalize="sentences" enterKeyHint="next" /><FieldError errors={fieldErrors} name="title" /></label>
                  {path !== 'class' && (
                    <label><span className="lbl">Type</span>
                      <select name="kind" required defaultValue="">
                        <option value="" disabled>Choose a type</option>
                        <option value="workshop">Workshop</option>
                        <option value="meetup">Meetup</option>
                        <option value="popup">Pop-up</option>
                        <option value="market">Flea market</option>
                      </select>
                    <FieldError errors={fieldErrors} name="kind" /></label>
                  )}
                  <label><span className="lbl">{path === 'class' ? 'About the class' : 'What happens at the event'}</span><textarea name="description" required maxLength={2000} rows={3} /><FieldError errors={fieldErrors} name="description" /></label>
                  <ImageUploader key={imagesKey} initial={draftImages} max={MAX_REQUEST_IMAGES} endpoint="/api/uploads/workshop-request-image" legend="Photos (up to 3)" onBusyChange={setUploading} />
                </div>
                <div className="host-step" data-step={1} hidden={step !== 1}>
                  {path === 'class'
                    ? <ClassWhenAndPrice errors={fieldErrors} startDate={startDate} setStartDate={setStartDate} rows={priceRows} setRows={setPriceRows} repeat={repeat} setRepeat={setRepeat} />
                    : <EventWhereWhen errors={fieldErrors} startDate={startDate} setStartDate={setStartDate} paid={paid} setPaid={setPaid} />}
                </div>
                <div className="host-step" data-step={2} hidden={step !== 2}>
                  <label><span className="lbl">Host, studio, cafe or organiser name</span><input name="hostName" required maxLength={150} autoComplete="organization" autoCapitalize="words" enterKeyHint="next" /><FieldError errors={fieldErrors} name="hostName" /></label>
                  <label><span className="lbl">Your name</span><input name="contactName" required maxLength={100} autoComplete="name" autoCapitalize="words" enterKeyHint="next" /><FieldError errors={fieldErrors} name="contactName" /></label>
                  <div className="admin-form-row">
                    <label><span className="lbl">Phone number</span><input name="phone" type="tel" inputMode="tel" required maxLength={40} pattern={PHONE_PATTERN} title={PHONE_HINT} placeholder="Example: 9999999999" autoComplete="tel" enterKeyHint="next" /><FieldError errors={fieldErrors} name="phone" /></label>
                    <label><span className="lbl">Email</span><input name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" /><FieldError errors={fieldErrors} name="email" /></label>
                  </div>
                  <label className="host-check"><input type="checkbox" name="phonePublic" /> <span>Show this number to the audience</span><small>Off by default: only our team sees your number. Tick it to show a Call button on your listing.</small></label>
                  <div className="admin-form-row">
                    <InstagramField errors={fieldErrors} />
                    <label>Website<input name="website" type="text" inputMode="url" maxLength={300} placeholder="yourstudio.in" autoComplete="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" /><FieldError errors={fieldErrors} name="website" /></label>
                  </div>
                  {path === 'class' ? <ClassAbout errors={fieldErrors} /> : <EventAbout errors={fieldErrors} />}
                  <label>Anything else we should know<textarea name="notes" maxLength={2000} rows={2} /><FieldError errors={fieldErrors} name="notes" /></label>
                  <div aria-hidden="true" className="hp-field"><input name="companyWebsite" tabIndex={-1} autoComplete="off" defaultValue="" /></div>
                </div>
                <div className="admin-actions">
                  {restored && <p className="host-draft-note" role="status">We restored your saved draft.</p>}
                  {restored && <button type="button" className="button host-start-over" onClick={startOver} disabled={sending}>Start over</button>}
                  {step === 0
                    ? <button type="button" className="button" onClick={close} disabled={sending}>Cancel</button>
                    : <button type="button" className="button" onClick={back} disabled={sending}><span aria-hidden="true">←</span> Back</button>}
                  {step < LAST
                    ? <button type="submit" className="button primary">Next <span aria-hidden="true">→</span></button>
                    : <button type="submit" className="button primary" disabled={sending || uploading} aria-busy={sending}>{sending ? 'Sending…' : 'Send details'}</button>}
                </div>
              </form>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

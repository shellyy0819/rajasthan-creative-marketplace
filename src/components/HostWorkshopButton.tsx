'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CityInput } from './CityInput';
import { ImageUploader } from './ImageUploader';
import { PHONE_HINT, PHONE_PATTERN } from '@/lib/phone';
import { DEFAULT_CONTACT_EMAIL } from '@/lib/site';
import { MAX_REQUEST_IMAGES, submitErrorMessage } from '@/lib/workshop-requests-shared';

const field = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Host a workshop": opens a form that collects every detail we need to list a workshop, meetup, pop-up or flea market. */
export function HostWorkshopButton({ className = 'button outline', contactEmail = DEFAULT_CONTACT_EMAIL }: { className?: string; contactEmail?: string }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [uploading, setUploading] = useState(false);
  // After the details are sent, the emailed code must be confirmed before the request counts.
  const [pending, setPending] = useState<{ id: string; name: string; email: string; from: string; to: string } | null>(null);
  const [info, setInfo] = useState('');
  const [wait, setWait] = useState(0); // seconds until another code may be requested
  const [done, setDone] = useState<{ name: string; email: string; from: string; to: string; confirmed: boolean; notified: boolean } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, sending]);

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
      <button ref={trigger} type="button" className={className} aria-haspopup="dialog" onClick={() => { setError(''); setDone(null); setPaid(false); setStartDate(''); setUploading(false); setPending(null); setInfo(''); setWait(0); setOpen(true); }}>Host a workshop <span>↗</span></button>
      {open && createPortal(
        <div className="contact-backdrop admin-modal" onClick={e => { if (e.target === e.currentTarget && !sending) close(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="host-title" className="contact-card">
            <div className="dialog-head">
              <h2 id="host-title">{done ? 'Request received' : pending ? 'Please verify your email' : 'Host a workshop or pop-up'}</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={close} disabled={sending}>✕</button>
            </div>
            {done ? (
              <div>
                <p><b>{done.notified ? 'Your workshop details are submitted successfully and the Craftofy team has been notified.' : 'Your workshop details are submitted.'}</b></p>
                <p>Thank you, {done.name}. {done.confirmed ? 'Your email is confirmed and we' : 'We'} have your details and will write to you on {done.email} soon.</p>
                <p>Dates received: {done.from === done.to ? done.from : `${done.from} to ${done.to}`}.</p>
                <div className="admin-actions"><button type="button" className="button primary" onClick={close}>Done</button></div>
              </div>
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
              <form className="admin-form" onSubmit={async e => {
                e.preventDefault();
                if (sending) return;
                setSending(true); setError('');
                const f = new FormData(e.currentTarget);
                const body = {
                  hostName: field(f, 'hostName'), contactName: field(f, 'contactName'), phone: field(f, 'phone'), email: field(f, 'email'),
                  cityRef: field(f, 'cityRef'), venue: field(f, 'venue'), title: field(f, 'title'), kind: field(f, 'kind'), description: field(f, 'description'),
                  startDate: field(f, 'startDate'), endDate: field(f, 'endDate'), startTime: field(f, 'startTime'), endTime: field(f, 'endTime'),
                  seats: field(f, 'seats') ? Number(field(f, 'seats')) : undefined,
                  priceType: paid ? 'PAID' : 'FREE', priceRupees: paid ? Number(field(f, 'priceRupees')) : undefined,
                  instagram: field(f, 'instagram'), website: field(f, 'website'), notes: field(f, 'notes'), images: f.getAll('images').map(v => String(v).trim()).filter(Boolean), companyWebsite: field(f, 'companyWebsite'),
                };
                try {
                  const { ok, data, error } = await post('/api/workshop-requests', body);
                  if (!ok || !data) { setError(error || submitErrorMessage(0, null, contactEmail)); setSending(false); return; }
                  const summary = { name: body.contactName, email: data.email ?? body.email, from: fmtDate(body.startDate), to: fmtDate(body.endDate || body.startDate) };
                  if (data.status === 'received') { setDone({ ...summary, confirmed: false, notified: false }); setSending(false); return; } // the code email could not be sent; we still have the details
                  setPending({ id: data.id ?? '', ...summary });
                  setWait(60); setSending(false);
                } catch { setError(submitErrorMessage(0, null, contactEmail)); setSending(false); }
              }}>
                <p className="form-note">Tell us about your event. We will review it and get back to you.</p>
                {error && <p role="alert" className="admin-error">{error}</p>}
                <label><span className="lbl">Event title</span><input name="title" required maxLength={150} autoFocus /></label>
                <label><span className="lbl">Type</span>
                  <select name="kind" required defaultValue="">
                    <option value="" disabled>Choose a type</option>
                    <option value="workshop">Workshop</option>
                    <option value="meetup">Meetup</option>
                    <option value="popup">Pop-up</option>
                    <option value="market">Flea market</option>
                  </select>
                </label>
                <label><span className="lbl">What happens at the event</span><textarea name="description" required maxLength={2000} rows={3} /></label>
                <div className="admin-form-row">
                  <label><span className="lbl">Start date</span><input name="startDate" type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
                  <label>End date<input name="endDate" type="date" min={startDate || undefined} /></label>
                </div>
                <p className="form-note">{startDate ? `If you leave the end date empty, the event ends on ${fmtDate(startDate)}, the start date.` : 'If you leave the end date empty, the event ends on the start date.'}</p>
                <div className="admin-form-row">
                  <label>Start time<input name="startTime" type="time" /></label>
                  <label>End time<input name="endTime" type="time" /></label>
                </div>
                <div className="admin-form-row">
                  <label><span className="lbl">City</span><CityInput required valueFormat="name" /></label>
                  <label>Seats<input name="seats" type="number" min={1} max={100000} inputMode="numeric" /></label>
                </div>
                <label><span className="lbl">Venue and address</span><input name="venue" required maxLength={300} autoComplete="street-address" /></label>
                <label className="check"><input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} /> Participants pay to attend</label>
                {paid && <label><span className="lbl">Price per person (Rs.)</span><input name="priceRupees" type="number" min={1} max={1000000} inputMode="numeric" required /></label>}
                <ImageUploader initial={[]} max={MAX_REQUEST_IMAGES} endpoint="/api/uploads/workshop-request-image" legend="Photos (up to 3)" onBusyChange={setUploading} />
                <label><span className="lbl">Host, studio, cafe or organiser name</span><input name="hostName" required maxLength={150} autoComplete="organization" /></label>
                <label><span className="lbl">Your name</span><input name="contactName" required maxLength={100} autoComplete="name" /></label>
                <div className="admin-form-row">
                  <label><span className="lbl">Phone number</span><input name="phone" type="tel" inputMode="tel" required maxLength={40} pattern={PHONE_PATTERN} title={PHONE_HINT} placeholder="9989898999" autoComplete="tel" /></label>
                  <label><span className="lbl">Email</span><input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
                </div>
                <div className="admin-form-row">
                  <label>Instagram<input name="instagram" maxLength={200} placeholder="@yourstudio" /></label>
                  <label>Website<input name="website" type="text" inputMode="url" maxLength={300} placeholder="yourstudio.in" /></label>
                </div>
                <label>Anything else we should know<textarea name="notes" maxLength={2000} rows={2} /></label>
                <div aria-hidden="true" className="hp-field"><input name="companyWebsite" tabIndex={-1} autoComplete="off" defaultValue="" /></div>
                <div className="admin-actions">
                  <button type="button" className="button" onClick={close} disabled={sending}>Cancel</button>
                  <button type="submit" className="button primary" disabled={sending || uploading} aria-busy={sending}>{sending ? 'Sending…' : 'Send details'}</button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

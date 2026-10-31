'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PHONE_HINT, PHONE_PATTERN } from '@/lib/phone';

const field = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** "List your craft": opens a form where a maker asks to be listed. The phone is format-checked here and on the server, not yet verified by SMS. */
export function ListingRequestButton() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ name: string; phone: string; email: string } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, sending]);

  return (
    <>
      <button ref={trigger} type="button" className="button light" aria-haspopup="dialog" onClick={() => { setError(''); setDone(null); setOpen(true); }}>List your craft <span>↗</span></button>
      {open && createPortal(
        <div className="contact-backdrop admin-modal" onClick={e => { if (e.target === e.currentTarget && !sending) close(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="listing-title" className="contact-card">
            <div className="dialog-head">
              <h2 id="listing-title">{done ? 'Request received' : 'Get your craft listed'}</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={close} disabled={sending}>✕</button>
            </div>
            {done ? (
              <div>
                <p>Thank you, {done.name}. We will call you on {done.phone} to talk about listing your craft.</p>
                <p>Once we confirm your request, sign in with Google using {done.email} to add your products.</p>
                <div className="admin-actions"><button type="button" className="button primary" onClick={close}>Done</button></div>
              </div>
            ) : (
              <form className="admin-form" onSubmit={async e => {
                e.preventDefault();
                if (sending) return;
                setSending(true); setError('');
                const f = new FormData(e.currentTarget);
                const body = {
                  ownerName: field(f, 'ownerName'), phone: field(f, 'phone'), email: field(f, 'email'), instagram: field(f, 'instagram'), website: field(f, 'website'),
                  businessName: field(f, 'businessName'), size: field(f, 'size'), companyWebsite: field(f, 'companyWebsite'),
                };
                try {
                  const r = await fetch('/api/listing-requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
                  const data = await r.json().catch(() => null);
                  if (!r.ok) { setError(data?.error ?? 'Something went wrong. Please try again.'); setSending(false); return; }
                  setDone({ name: body.ownerName, phone: body.phone, email: body.email }); setSending(false);
                } catch { setError('Network error. Please try again.'); setSending(false); }
              }}>
                <p className="form-note">We will call the number you give to discuss your listing.</p>
                {error && <p role="alert" className="admin-error">{error}</p>}
                <label><span className="lbl">Owner name</span><input name="ownerName" required maxLength={100} autoComplete="name" autoFocus /></label>
                <label><span className="lbl">Phone number</span><input name="phone" type="tel" inputMode="tel" required maxLength={40} pattern={PHONE_PATTERN} title={PHONE_HINT} placeholder="9989898999" autoComplete="tel" /></label>
                <label><span className="lbl">Email</span><input name="email" type="email" required maxLength={254} autoComplete="email" />
                  <small>Use the Google account you will sign in with to list your products.</small>
                </label>
                <label><span className="lbl">Business or brand name</span><input name="businessName" required maxLength={150} autoComplete="organization" /></label>
                <div className="admin-form-row">
                  <label>Instagram handle (optional)<input name="instagram" maxLength={200} placeholder="@yourbrand" /></label>
                  <label>Website (optional)<input name="website" type="text" inputMode="url" maxLength={300} placeholder="yourbrand.in" /></label>
                </div>
                <label><span className="lbl">Business size</span>
                  <select name="size" required defaultValue="">
                    <option value="" disabled>Choose a size</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                  <small>Small: one maker or a home studio. Medium: a small team. Large: an established brand.</small>
                </label>
                <div aria-hidden="true" className="hp-field"><input name="companyWebsite" tabIndex={-1} autoComplete="off" defaultValue="" /></div>
                <div className="admin-actions">
                  <button type="button" className="button" onClick={close} disabled={sending}>Cancel</button>
                  <button type="submit" className="button primary" disabled={sending} aria-busy={sending}>{sending ? 'Sending…' : 'Send request'}</button>
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
